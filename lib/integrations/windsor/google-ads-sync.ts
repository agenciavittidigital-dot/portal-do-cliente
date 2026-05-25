import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// ── Constantes ─────────────────────────────────────────────────────────────────

const WINDSOR_ALL_ENDPOINT = "https://connectors.windsor.ai/all";

// Campos confirmados para sincronização Google Ads
// "conversions" é opcional — pode ser rejeitado pela Windsor
export const GOOGLE_ADS_SYNC_FIELDS = [
  "date",
  "datasource",
  "account_name",
  "source",
  "campaign",
  "clicks",
  "spend",
  "impressions",
  "ctr",
  "cpc",
  "cpm",
  "conversions",
] as const;

// Identifica registros Google Ads pelo campo datasource
function isGoogleAds(datasource: unknown): boolean {
  if (typeof datasource !== "string" || !datasource) return false;
  const lower = datasource.toLowerCase();
  return (
    lower.includes("google") ||
    lower.includes("adwords") ||
    lower === "gads" ||
    lower === "ga"
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function safeNum(val: unknown): number {
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

function safeStr(val: unknown): string | null {
  if (val === null || val === undefined || val === "") return null;
  return String(val);
}

function slugify(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 60);
}

function sanitizeBody(raw: string): string {
  return raw.replace(/api_key=[^\s&"']*/gi, "api_key=***").slice(0, 300);
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface Integration {
  integrationId: string;
  clientId: string;
  accountId: string;
  accountName: string;
}

interface AggregatedRecord {
  integration: Integration;
  date: string;
  accountName: string;
  campaignName: string | null;
  campaignId: string;
  spend: number;
  clicks: number;
  impressions: number;
  conversions: number;
  groupedCount: number;
  rawSample: Record<string, unknown>;
}

export interface GoogleAdsSyncSample {
  date: string;
  accountName: string;
  campaignName: string | null;
  spend: number;
  clicks: number;
  impressions: number;
  conversions: number;
}

export interface GoogleAdsSyncResult {
  success: boolean;
  totalFetched: number;
  googleAdsRecords: number;
  mappedRecords: number;
  groupedRecords: number;
  skippedUnmapped: number;
  upserted: number;
  errors: number;
  datePreset: string;
  fieldsSynced: string[];
  unmappedAccounts: string[];
  sampleSaved: GoogleAdsSyncSample[];
  error?: string;
  errorDetail?: string;
}

// ── Fetch Windsor ─────────────────────────────────────────────────────────────

async function fetchGoogleAdsData(): Promise<{
  data?: Record<string, unknown>[];
  fieldsSynced: string[];
  error?: string;
}> {
  const apiKey = process.env.WINDSOR_API_KEY?.trim();
  if (!apiKey) {
    return { fieldsSynced: [], error: "WINDSOR_API_KEY não configurada." };
  }

  // Tenta com conversions primeiro; se rejeitar, tenta sem
  for (const fields of [
    [...GOOGLE_ADS_SYNC_FIELDS],
    GOOGLE_ADS_SYNC_FIELDS.filter((f) => f !== "conversions"),
  ]) {
    const url = new URL(WINDSOR_ALL_ENDPOINT);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("fields", fields.join(","));
    url.searchParams.set("date_preset", "last_7d");

    try {
      const res = await fetch(url.toString(), {
        method: "GET",
        headers: { Accept: "application/json" },
        next: { revalidate: 0 },
      });

      if (!res.ok) {
        const raw = await res.text().catch(() => "");
        if (fields.includes("conversions")) continue; // tenta sem conversions
        return {
          fieldsSynced: [],
          error: `Windsor HTTP ${res.status}: ${sanitizeBody(raw)}`,
        };
      }

      const json = (await res.json()) as { data?: Record<string, unknown>[] };
      return { data: json.data ?? [], fieldsSynced: fields as string[] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      if (fields.includes("conversions")) continue;
      return { fieldsSynced: [], error: `Falha na conexão: ${msg}` };
    }
  }

  return { fieldsSynced: [], error: "Windsor rejeitou todos os conjuntos de campos." };
}

// ── Sync principal ────────────────────────────────────────────────────────────

export async function syncGoogleAdsMappedAccounts(): Promise<GoogleAdsSyncResult> {
  const base: GoogleAdsSyncResult = {
    success: false,
    totalFetched: 0,
    googleAdsRecords: 0,
    mappedRecords: 0,
    groupedRecords: 0,
    skippedUnmapped: 0,
    upserted: 0,
    errors: 0,
    datePreset: "last_7d",
    fieldsSynced: [],
    unmappedAccounts: [],
    sampleSaved: [],
  };

  // ── 1. Fetch Windsor ──────────────────────────────────────────────────────
  const { data: allData, fieldsSynced, error: fetchError } = await fetchGoogleAdsData();

  if (fetchError || !allData) {
    return { ...base, error: fetchError ?? "Sem dados retornados pela Windsor." };
  }

  base.totalFetched = allData.length;
  base.fieldsSynced = fieldsSynced;

  // ── 2. Filtra apenas registros Google Ads ─────────────────────────────────
  const googleRows = allData.filter((row) => isGoogleAds(row.datasource));
  base.googleAdsRecords = googleRows.length;

  if (googleRows.length === 0) {
    return { ...base, success: true };
  }

  const admin = createAdminClient();

  // ── 3. Carrega mapeamentos ativos Google Ads ──────────────────────────────
  const { data: integrationRows, error: integError } = await admin
    .from("client_integrations")
    .select("id, client_id, account_id, account_name")
    .eq("provider", "windsor")
    .eq("channel", "google_ads")
    .eq("status", "active");

  if (integError) {
    console.error("[google-ads/sync] Erro ao carregar mapeamentos:", integError.message);
    return { ...base, error: "Erro ao carregar mapeamentos.", errorDetail: integError.message };
  }

  const integByName = new Map<string, Integration>();
  for (const row of integrationRows ?? []) {
    const name = String(row.account_name ?? "").trim();
    if (!name) continue;
    integByName.set(name, {
      integrationId: String(row.id),
      clientId: String(row.client_id),
      accountId: String(row.account_id ?? ""),
      accountName: name,
    });
  }

  // ── 4. Agrega registros pela constraint ───────────────────────────────────
  const aggregated = new Map<string, AggregatedRecord>();
  const unmappedSet = new Set<string>();

  for (const raw of googleRows) {
    const accountName = String(raw.account_name ?? "").trim();
    if (!accountName) continue;

    const integ = integByName.get(accountName);
    if (!integ) {
      unmappedSet.add(accountName);
      base.skippedUnmapped++;
      continue;
    }

    const date = safeStr(raw.date) ?? new Date().toISOString().slice(0, 10);
    const campaignName = safeStr(raw.campaign ?? raw.campaign_name);
    const campaignId = campaignName
      ? `${slugify(accountName)}_${slugify(campaignName)}`
      : slugify(accountName);

    const key = [
      integ.clientId,
      integ.integrationId,
      "google_ads",
      date,
      campaignId,
      "unknown",
      "unknown",
    ].join("::");

    const existing = aggregated.get(key);
    if (existing) {
      existing.spend += safeNum(raw.spend);
      existing.clicks += safeNum(raw.clicks);
      existing.impressions += safeNum(raw.impressions);
      existing.conversions += safeNum(raw.conversions);
      existing.groupedCount++;
    } else {
      aggregated.set(key, {
        integration: integ,
        date,
        accountName,
        campaignName,
        campaignId,
        spend: safeNum(raw.spend),
        clicks: safeNum(raw.clicks),
        impressions: safeNum(raw.impressions),
        conversions: safeNum(raw.conversions),
        groupedCount: 1,
        rawSample: raw as Record<string, unknown>,
      });
    }

    base.mappedRecords++;
  }

  base.unmappedAccounts = [...unmappedSet].slice(0, 10);
  base.groupedRecords = aggregated.size;

  if (aggregated.size === 0) {
    return { ...base, success: true };
  }

  // ── 5. Monta payload de upsert ────────────────────────────────────────────
  const syncedAt = new Date().toISOString();
  const rows: Record<string, unknown>[] = [];

  for (const rec of aggregated.values()) {
    const cpc = rec.clicks > 0 ? rec.spend / rec.clicks : 0;
    const cpm = rec.impressions > 0 ? (rec.spend / rec.impressions) * 1000 : 0;
    const ctr = rec.impressions > 0 ? (rec.clicks / rec.impressions) * 100 : 0;

    rows.push({
      client_id: rec.integration.clientId,
      integration_id: rec.integration.integrationId,
      channel: "google_ads",
      date: rec.date,
      account_id: rec.integration.accountId,
      account_name: rec.accountName,
      campaign_id: rec.campaignId,
      campaign_name: rec.campaignName,
      adset_id: "unknown",
      adset_name: null,
      ad_id: "unknown",
      ad_name: null,
      spend: rec.spend,
      clicks: rec.clicks,
      impressions: rec.impressions,
      reach: 0,
      frequency: 0,
      ctr,
      cpc,
      cpm,
      // Google Ads "conversions" → coluna leads (melhor fit sem schema change)
      leads: rec.conversions,
      messages_started: 0,
      purchases: 0,
      purchase_value: 0,
      roas: 0,
      engagements: 0,
      video_views_25: 0,
      video_views_75: 0,
      raw_data: {
        google_ads_raw_sample: rec.rawSample,
        sync_meta: {
          synced_at: syncedAt,
          date_preset: "last_7d",
          integration_id: rec.integration.integrationId,
          channel: "google_ads",
          matched_by: "account_name",
          grouped_count: rec.groupedCount,
          fields_synced: fieldsSynced,
        },
      },
      updated_at: syncedAt,
    });
  }

  // ── 6. Upsert idempotente ─────────────────────────────────────────────────
  const { error: upsertError } = await admin
    .from("performance_daily")
    .upsert(rows, {
      onConflict: "client_id,integration_id,channel,date,campaign_id,adset_id,ad_id",
      ignoreDuplicates: false,
    });

  if (upsertError) {
    console.error("[google-ads/sync] Erro no upsert:", upsertError.message);
    return {
      ...base,
      error: "Falha ao gravar em performance_daily.",
      errorDetail: upsertError.message,
    };
  }

  base.upserted = rows.length;

  base.sampleSaved = [...aggregated.values()].slice(0, 3).map((r) => ({
    date: r.date,
    accountName: r.accountName,
    campaignName: r.campaignName,
    spend: r.spend,
    clicks: r.clicks,
    impressions: r.impressions,
    conversions: r.conversions,
  }));

  return { ...base, success: true };
}

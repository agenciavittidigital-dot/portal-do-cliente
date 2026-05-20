import "server-only";
import { fetchWindsorRawData } from "./client";
import { createAdminClient } from "@/lib/supabase/admin";

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

// ── Types ─────────────────────────────────────────────────────────────────────

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
  groupedCount: number;
  rawSample: Record<string, unknown>;
}

export interface SyncSample {
  date: string;
  accountName: string;
  campaignName: string | null;
  spend: number;
  clicks: number;
}

export interface SyncResult {
  success: boolean;
  totalFetched: number;
  mappedRecords: number;
  groupedRecords: number;
  skippedUnmapped: number;
  upserted: number;
  errors: number;
  datePreset: string;
  unmappedAccounts: string[];
  sampleSaved: SyncSample[];
  error?: string;
  errorDetail?: string;
}

// ── Core sync ─────────────────────────────────────────────────────────────────

export async function syncWindsorMappedAccounts(): Promise<SyncResult> {
  const base: SyncResult = {
    success: false,
    totalFetched: 0,
    mappedRecords: 0,
    groupedRecords: 0,
    skippedUnmapped: 0,
    upserted: 0,
    errors: 0,
    datePreset: "last_7d",
    unmappedAccounts: [],
    sampleSaved: [],
  };

  // ── 1. Fetch Windsor ──────────────────────────────────────────────────────
  const response = await fetchWindsorRawData();

  if (response.error) {
    const detail = response.errorDetail ? ` — ${response.errorDetail}` : "";
    return { ...base, error: response.error + detail };
  }

  if (!response.data?.length) {
    return { ...base, success: true };
  }

  base.totalFetched = response.data.length;

  const admin = createAdminClient();

  // ── 2. Carregar mapeamentos ativos ────────────────────────────────────────
  const { data: integrationRows, error: integError } = await admin
    .from("client_integrations")
    .select("id, client_id, account_id, account_name")
    .eq("provider", "windsor")
    .eq("channel", "meta_ads")
    .eq("status", "active");

  if (integError) {
    console.error("[windsor/sync] Erro ao carregar mapeamentos:", integError.message);
    return { ...base, error: "Erro ao carregar mapeamentos.", errorDetail: integError.message };
  }

  // accountName → Integration
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

  // ── 3. Agregar registros pela chave real da constraint ────────────────────
  //
  // Constraint: client_id + integration_id + channel + date + campaign_id + adset_id + ad_id
  //
  // Campos mínimos da Windsor nesta sprint:
  //   date, account_name, campaign (→ campaign_name), clicks, spend
  //
  // Fallbacks fixos: adset_id = "unknown", ad_id = "unknown"
  // campaign_id = slug estável derivado de account_name + campaign

  const aggregated = new Map<string, AggregatedRecord>();
  const unmappedSet = new Set<string>();

  for (const raw of response.data) {
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

    // campaign_id: fallback estável que não muda entre syncs para o mesmo par account+campaign
    const campaignId = campaignName
      ? `${slugify(accountName)}_${slugify(campaignName)}`
      : slugify(accountName);

    // Chave espelha exatamente as colunas da constraint do banco
    const key = [
      integ.clientId,
      integ.integrationId,
      "meta_ads",
      date,
      campaignId,
      "unknown", // adset_id
      "unknown", // ad_id
    ].join("::");

    const existing = aggregated.get(key);
    if (existing) {
      // Múltiplos registros Windsor para a mesma linha → soma métricas
      existing.spend += safeNum(raw.spend);
      existing.clicks += safeNum(raw.clicks);
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

  // ── 4. Montar payload de upsert ───────────────────────────────────────────
  const syncedAt = new Date().toISOString();
  const rows: Record<string, unknown>[] = [];

  for (const rec of aggregated.values()) {
    const cpc = rec.clicks > 0 ? rec.spend / rec.clicks : 0;

    rows.push({
      client_id: rec.integration.clientId,
      integration_id: rec.integration.integrationId,
      channel: "meta_ads",
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
      impressions: 0,
      reach: 0,
      ctr: 0,
      cpc,
      cpm: 0,
      messages_started: 0,
      leads: 0,
      purchases: 0,
      purchase_value: 0,
      roas: 0,
      engagements: 0,
      video_views_25: 0,
      video_views_75: 0,
      frequency: 0,
      raw_data: {
        windsor_raw_sample: rec.rawSample,
        sync_meta: {
          synced_at: syncedAt,
          date_preset: "last_7d",
          integration_id: rec.integration.integrationId,
          matched_by: "account_name",
          grouped_count: rec.groupedCount,
        },
      },
      updated_at: syncedAt,
    });
  }

  // ── 5. Upsert usando as colunas exatas da constraint ──────────────────────
  //
  // onConflict deve listar as colunas da constraint, não o nome da constraint.
  // A constraint real é: client_id, integration_id, channel, date, campaign_id, adset_id, ad_id
  // Isso garante idempotência: rodar duas vezes atualiza, nunca duplica.

  const { error: upsertError } = await admin
    .from("performance_daily")
    .upsert(rows, {
      onConflict: "client_id,integration_id,channel,date,campaign_id,adset_id,ad_id",
      ignoreDuplicates: false,
    });

  if (upsertError) {
    console.error("[windsor/sync] Erro no upsert:", upsertError.message);
    return {
      ...base,
      error: "Falha ao gravar em performance_daily.",
      errorDetail: upsertError.message,
    };
  }

  base.upserted = rows.length;

  // ── 6. Amostra dos registros gravados (sem dados sensíveis) ───────────────
  base.sampleSaved = [...aggregated.values()].slice(0, 3).map((r) => ({
    date: r.date,
    accountName: r.accountName,
    campaignName: r.campaignName,
    spend: r.spend,
    clicks: r.clicks,
  }));

  return { ...base, success: true };
}

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWindsorStatus } from "./client";

const WINDSOR_ALL_ENDPOINT = "https://connectors.windsor.ai/all";

const KEYWORD_SYNC_FIELDS = [
  "keyword_text",
  "date",
  "campaign",
  "impressions",
  "clicks",
  "datasource",
  "account_name",
];

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

export interface KeywordsSyncResult {
  success: boolean;
  error?: string;
  rowsFetched: number;
  googleAdsRows: number;
  rowsSkipped: number;
  rowsUpserted: number;
  integrationsMatched: number;
  syncedAt: string;
}

export async function syncGoogleAdsKeywords(): Promise<KeywordsSyncResult> {
  const syncedAt = new Date().toISOString();
  const admin = createAdminClient();

  const status = getWindsorStatus();
  if (!status.configured) {
    return {
      success: false,
      error: status.reason,
      rowsFetched: 0,
      googleAdsRows: 0,
      rowsSkipped: 0,
      rowsUpserted: 0,
      integrationsMatched: 0,
      syncedAt,
    };
  }

  // ── 1. Carrega integrações Google Ads ativas ──────────────────────────────
  const { data: integrations, error: intErr } = await admin
    .from("client_integrations")
    .select("id, client_id, account_name")
    .eq("provider", "windsor")
    .eq("channel", "google_ads")
    .eq("status", "active");

  if (intErr || !integrations?.length) {
    return {
      success: false,
      error: intErr?.message ?? "Nenhuma integração Google Ads ativa encontrada.",
      rowsFetched: 0,
      googleAdsRows: 0,
      rowsSkipped: 0,
      rowsUpserted: 0,
      integrationsMatched: 0,
      syncedAt,
    };
  }

  // Mapa account_name (lowercase) → { integration_id, client_id }
  const integrationMap = new Map<string, { id: string; clientId: string }>();
  for (const i of integrations) {
    const name = (i.account_name ?? "").trim().toLowerCase();
    if (name) integrationMap.set(name, { id: i.id, clientId: i.client_id });
  }

  // ── 2. Busca dados da Windsor ─────────────────────────────────────────────
  const apiKey = process.env.WINDSOR_API_KEY!;
  const url = new URL(WINDSOR_ALL_ENDPOINT);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("fields", KEYWORD_SYNC_FIELDS.join(","));
  url.searchParams.set("date_preset", "last_7d");

  let allData: Record<string, unknown>[] = [];

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      const raw = await res.text().catch(() => "");
      const safe = raw.replace(/api_key=[^\s&"']*/gi, "api_key=***").slice(0, 400);
      return {
        success: false,
        error: `Windsor respondeu HTTP ${res.status}: ${safe}`,
        rowsFetched: 0,
        googleAdsRows: 0,
        rowsSkipped: 0,
        rowsUpserted: 0,
        integrationsMatched: 0,
        syncedAt,
      };
    }

    const json = (await res.json()) as { data?: Record<string, unknown>[] };
    allData = json.data ?? [];
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return {
      success: false,
      error: `Falha na conexão com Windsor: ${msg}`,
      rowsFetched: 0,
      googleAdsRows: 0,
      rowsSkipped: 0,
      rowsUpserted: 0,
      integrationsMatched: 0,
      syncedAt,
    };
  }

  const googleRows = allData.filter((r) => isGoogleAds(r.datasource));

  // ── 3. Agrega por (client_id, integration_id, date, campaign_name, keyword_text) ──
  interface AggRow {
    client_id: string;
    integration_id: string;
    date: string;
    campaign_name: string;
    keyword_text: string;
    impressions: number;
    clicks: number;
    synced_at: string;
  }

  const agg = new Map<string, AggRow>();
  let skipped = 0;
  const matchedIds = new Set<string>();

  for (const row of googleRows) {
    const kwText = typeof row.keyword_text === "string" ? row.keyword_text.trim() : "";
    if (!kwText) { skipped++; continue; }

    const accountName = (typeof row.account_name === "string" ? row.account_name : "").trim().toLowerCase();
    const integration = integrationMap.get(accountName);
    if (!integration) { skipped++; continue; }

    const date = typeof row.date === "string" ? row.date.slice(0, 10) : "";
    if (!date) { skipped++; continue; }

    const campaign = typeof row.campaign === "string" && row.campaign.trim()
      ? row.campaign.trim()
      : "unknown";
    const impressions = Number(row.impressions) || 0;
    const clicks = Number(row.clicks) || 0;

    const key = `${integration.clientId}|${integration.id}|${date}|${campaign}|${kwText}`;
    matchedIds.add(integration.id);

    const existing = agg.get(key);
    if (existing) {
      existing.impressions += impressions;
      existing.clicks += clicks;
    } else {
      agg.set(key, {
        client_id: integration.clientId,
        integration_id: integration.id,
        date,
        campaign_name: campaign,
        keyword_text: kwText,
        impressions,
        clicks,
        synced_at: syncedAt,
      });
    }
  }

  if (agg.size === 0) {
    return {
      success: true,
      rowsFetched: allData.length,
      googleAdsRows: googleRows.length,
      rowsSkipped: skipped,
      rowsUpserted: 0,
      integrationsMatched: matchedIds.size,
      syncedAt,
    };
  }

  // ── 4. Upsert em lotes de 200 ─────────────────────────────────────────────
  const records = [...agg.values()];
  const BATCH = 200;
  let upserted = 0;

  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH);
    const { error } = await admin
      .from("performance_keywords")
      .upsert(batch, {
        onConflict: "client_id,integration_id,date,campaign_name,keyword_text",
        ignoreDuplicates: false,
      });

    if (error) {
      return {
        success: false,
        error: `Erro no upsert (lote ${i / BATCH + 1}): ${error.message}`,
        rowsFetched: allData.length,
        googleAdsRows: googleRows.length,
        rowsSkipped: skipped,
        rowsUpserted: upserted,
        integrationsMatched: matchedIds.size,
        syncedAt,
      };
    }
    upserted += batch.length;
  }

  return {
    success: true,
    rowsFetched: allData.length,
    googleAdsRows: googleRows.length,
    rowsSkipped: skipped,
    rowsUpserted: upserted,
    integrationsMatched: matchedIds.size,
    syncedAt,
  };
}

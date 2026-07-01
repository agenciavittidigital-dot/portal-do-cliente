import "server-only";
import { fetchWindsorSyncData, WINDSOR_SYNC_FIELDS } from "./client";
import {
  extractFromActions,
  LEAD_ACTION_TYPES,
  MESSAGE_ACTION_TYPES,
  PURCHASE_ACTION_TYPES,
} from "./normalizers";
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
  campaignObjective: string | null;
  campaignId: string;
  adId: string;
  adName: string | null;
  // Métricas somáveis
  spend: number;
  clicks: number;
  impressions: number;
  reach: number;
  leads: number;
  messages_started: number;
  purchases: number;
  purchase_value: number;
  engagements: number;
  video_views_25: number;
  video_views_75: number;
  landing_page_views: number;
  // ROAS: soma ponderada por spend para calcular média ponderada ao final
  roasWeightedSum: number;
  groupedCount: number;
  rawSample: Record<string, unknown>;
  thumbnail_url: string | null;
}

export interface SyncSample {
  date: string;
  accountName: string;
  campaignName: string | null;
  spend: number;
  clicks: number;
  impressions: number;
  leads: number;
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
  fieldsSynced: string[];
  unmappedAccounts: string[];
  sampleSaved: SyncSample[];
  error?: string;
  errorDetail?: string;
}

// ── Core sync ─────────────────────────────────────────────────────────────────

export async function syncWindsorMappedAccounts(): Promise<SyncResult> {
  const today = new Date();
  const dateTo = today.toISOString().slice(0, 10);
  const fromDay = new Date(today);
  fromDay.setUTCDate(fromDay.getUTCDate() - 6);
  const dateFrom = fromDay.toISOString().slice(0, 10);
  const dateRange = `${dateFrom}/${dateTo}`;

  const base: SyncResult = {
    success: false,
    totalFetched: 0,
    mappedRecords: 0,
    groupedRecords: 0,
    skippedUnmapped: 0,
    upserted: 0,
    errors: 0,
    datePreset: dateRange,
    fieldsSynced: [...WINDSOR_SYNC_FIELDS],
    unmappedAccounts: [],
    sampleSaved: [],
  };

  // ── 1. Fetch Windsor (conjunto completo de campos) ────────────────────────
  const response = await fetchWindsorSyncData();

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

    // ad_id: usa o real quando Windsor retorna; fallback para slug derivado de ad_name; senão "unknown"
    const rawAdId = safeStr(raw.ad_id);
    const adName = safeStr(raw.ad_name);
    const adId = rawAdId
      ? rawAdId
      : adName
      ? `adname_${slugify(adName)}`
      : "unknown";

    // Chave espelha exatamente as colunas da constraint do banco
    const key = [
      integ.clientId,
      integ.integrationId,
      "meta_ads",
      date,
      campaignId,
      "unknown", // adset_id (sem suporte Windsor por enquanto)
      adId,
    ].join("::");

    // Prioridade: campo achatado Windsor → escalar legado → array fallback
    const rawLeads =
      safeNum(raw.actions_onsite_conversion_lead_grouped) ||
      safeNum(raw.leads) ||
      extractFromActions(raw.actions, LEAD_ACTION_TYPES);
    const rawMessages =
      safeNum(raw.actions_onsite_conversion_messaging_conversation_started_7d) ||
      safeNum(raw.messages_started) ||
      extractFromActions(raw.actions, MESSAGE_ACTION_TYPES);
    const rawPurchases =
      safeNum(raw.actions_offsite_conversion_fb_pixel_purchase) ||
      safeNum(raw.purchases) ||
      extractFromActions(raw.actions, PURCHASE_ACTION_TYPES);
    const rawPurchaseValue =
      safeNum(raw.action_values_offsite_conversion_fb_pixel_purchase) ||
      safeNum(raw.purchase_value) ||
      extractFromActions(raw.action_values, PURCHASE_ACTION_TYPES);

    const existing = aggregated.get(key);
    if (existing) {
      const rawSpend = safeNum(raw.spend);
      existing.spend += rawSpend;
      existing.clicks += safeNum(raw.clicks);
      existing.impressions += safeNum(raw.impressions);
      existing.reach += safeNum(raw.reach);
      existing.leads += rawLeads;
      existing.messages_started += rawMessages;
      existing.purchases += rawPurchases;
      existing.purchase_value += rawPurchaseValue;
      existing.engagements += safeNum(raw.engagements);
      existing.video_views_25 += safeNum(raw.video_views_25);
      existing.video_views_75 += safeNum(raw.video_views_75);
      existing.landing_page_views += safeNum(raw.actions_landing_page_view);
      existing.roasWeightedSum += safeNum(raw.roas) * rawSpend;
      existing.groupedCount++;
      if (!existing.thumbnail_url) existing.thumbnail_url = safeStr(raw.thumbnail_url);
      if (!existing.campaignObjective) existing.campaignObjective = safeStr(raw.wcf__objetivo);
    } else {
      const rawSpend = safeNum(raw.spend);
      aggregated.set(key, {
        integration: integ,
        date,
        accountName,
        campaignName,
        campaignObjective: safeStr(raw.wcf__objetivo),
        campaignId,
        adId,
        adName,
        spend: rawSpend,
        clicks: safeNum(raw.clicks),
        impressions: safeNum(raw.impressions),
        reach: safeNum(raw.reach),
        leads: rawLeads,
        messages_started: rawMessages,
        purchases: rawPurchases,
        purchase_value: rawPurchaseValue,
        engagements: safeNum(raw.engagements),
        video_views_25: safeNum(raw.video_views_25),
        video_views_75: safeNum(raw.video_views_75),
        landing_page_views: safeNum(raw.actions_landing_page_view),
        roasWeightedSum: safeNum(raw.roas) * rawSpend,
        groupedCount: 1,
        rawSample: raw as Record<string, unknown>,
        thumbnail_url: safeStr(raw.thumbnail_url),
      });
    }

    base.mappedRecords++;
  }

  base.unmappedAccounts = [...unmappedSet].slice(0, 10);
  base.groupedRecords = aggregated.size;

  if (aggregated.size === 0) {
    return { ...base, success: true };
  }

  // ── 4. Limpar linhas de nível de campanha substituídas por ad-level ─────────
  //
  // Quando Windsor retorna ad_id real, novos registros têm chave diferente das linhas
  // antigas (ad_id="unknown"). Sem cleanup, ambos coexistem e causam dupla contagem.
  // Deleta somente as linhas "unknown" para (client, integration, date) que agora têm dados
  // por anúncio real — preserva linhas de outros períodos ou integrações intocadas.

  const hasRealAdIds = [...aggregated.values()].some((r) => r.adId !== "unknown");

  if (hasRealAdIds) {
    type CleanKey = { clientId: string; integrationId: string; dates: string[] };
    const cleanByInteg = new Map<string, CleanKey>();

    for (const rec of aggregated.values()) {
      if (rec.adId === "unknown") continue;
      const mapKey = `${rec.integration.clientId}::${rec.integration.integrationId}`;
      const existing = cleanByInteg.get(mapKey);
      if (existing) {
        if (!existing.dates.includes(rec.date)) existing.dates.push(rec.date);
      } else {
        cleanByInteg.set(mapKey, {
          clientId: rec.integration.clientId,
          integrationId: rec.integration.integrationId,
          dates: [rec.date],
        });
      }
    }

    for (const ck of cleanByInteg.values()) {
      await admin
        .from("performance_daily")
        .delete()
        .eq("client_id", ck.clientId)
        .eq("integration_id", ck.integrationId)
        .eq("channel", "meta_ads")
        .in("date", ck.dates)
        .eq("ad_id", "unknown");
    }
  }

  // ── 5. Montar payload de upsert ───────────────────────────────────────────
  const syncedAt = new Date().toISOString();
  const rows: Record<string, unknown>[] = [];

  for (const rec of aggregated.values()) {
    // Métricas derivadas — calculadas dos totais agrupados
    const cpc = rec.clicks > 0 ? rec.spend / rec.clicks : 0;
    const cpm = rec.impressions > 0 ? (rec.spend / rec.impressions) * 1000 : 0;
    const ctr = rec.impressions > 0 ? (rec.clicks / rec.impressions) * 100 : 0;
    const frequency = rec.reach > 0 ? rec.impressions / rec.reach : 0;
    // ROAS: recalculado de purchase_value/spend quando há purchase_value (mais preciso);
    // fallback para ROAS Windsor escalar ponderado (quando Windsor retorna roas mas não purchase_value)
    const roas = rec.purchase_value > 0 && rec.spend > 0
      ? rec.purchase_value / rec.spend
      : rec.roasWeightedSum > 0 && rec.spend > 0
      ? rec.roasWeightedSum / rec.spend
      : 0;

    rows.push({
      client_id: rec.integration.clientId,
      integration_id: rec.integration.integrationId,
      channel: "meta_ads",
      date: rec.date,
      account_id: rec.integration.accountId,
      account_name: rec.accountName,
      campaign_id: rec.campaignId,
      campaign_name: rec.campaignName,
      campaign_objective: rec.campaignObjective,
      adset_id: "unknown",
      adset_name: null,
      ad_id: rec.adId,
      ad_name: rec.adName,
      spend: rec.spend,
      clicks: rec.clicks,
      impressions: rec.impressions,
      reach: rec.reach,
      frequency,
      ctr,
      cpc,
      cpm,
      leads: rec.leads,
      messages_started: rec.messages_started,
      purchases: rec.purchases,
      purchase_value: rec.purchase_value,
      roas,
      engagements: rec.engagements,
      video_views_25: rec.video_views_25,
      video_views_75: rec.video_views_75,
      landing_page_views: rec.landing_page_views,
      thumbnail_url: rec.thumbnail_url,
      raw_data: {
        windsor_raw_sample: rec.rawSample,
        sync_meta: {
          synced_at: syncedAt,
          date_preset: dateRange,
          integration_id: rec.integration.integrationId,
          matched_by: "account_name",
          grouped_count: rec.groupedCount,
          fields_synced: WINDSOR_SYNC_FIELDS,
        },
      },
      updated_at: syncedAt,
    });
  }

  // ── 6. Upsert usando as colunas exatas da constraint ──────────────────────
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

  // ── 7. Amostra dos registros gravados (sem dados sensíveis) ───────────────
  base.sampleSaved = [...aggregated.values()].slice(0, 3).map((r) => ({
    date: r.date,
    accountName: r.accountName,
    campaignName: r.campaignName,
    spend: r.spend,
    clicks: r.clicks,
    impressions: r.impressions,
    leads: r.leads,
  }));

  return { ...base, success: true };
}

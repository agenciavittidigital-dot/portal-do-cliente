import "server-only";
import type { WindsorNormalizedRecord, WindsorRawRecord } from "./types";

// Converte qualquer valor para número de forma segura, com fallback 0
function safeNum(val: unknown): number {
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

// Converte qualquer valor para string | null
function safeStr(val: unknown): string | null {
  if (val === null || val === undefined || val === "") return null;
  return String(val);
}

// ── Action type priority lists ────────────────────────────────────────────────
// Meta Ads retorna conversões dentro de arrays actions/action_values.
// Cada lista define a ordem de prioridade: o primeiro tipo com valor > 0 vence.

export const MESSAGE_ACTION_TYPES = [
  "onsite_conversion.messaging_conversation_started_7d",
  "messaging_conversation_started",
  "messaging_conversations_started",
];

export const LEAD_ACTION_TYPES = [
  "lead",
  "onsite_conversion.lead_grouped",
  "offsite_conversion.fb_pixel_lead",
  "leadgen_grouped",
];

export const PURCHASE_ACTION_TYPES = [
  "purchase",
  "offsite_conversion.fb_pixel_purchase",
  "omni_purchase",
  "website_purchase",
];

/**
 * Extrai o valor de um tipo de ação a partir de um array actions/action_values.
 * Usa prioridade: retorna o primeiro tipo da lista que tiver valor > 0.
 * Evita dupla contagem (purchase e offsite_conversion.fb_pixel_purchase são o mesmo evento).
 */
export function extractFromActions(
  actions: unknown,
  actionTypes: string[]
): number {
  if (!Array.isArray(actions)) return 0;
  for (const targetType of actionTypes) {
    for (const item of actions) {
      if (typeof item !== "object" || item === null) continue;
      const obj = item as Record<string, unknown>;
      if (String(obj.action_type ?? "") === targetType) {
        const val = safeNum(obj.value);
        if (val > 0) return val;
      }
    }
  }
  return 0;
}

// Normaliza um registro bruto Windsor → formato performance_daily
// Nunca lança exceção: campos ausentes recebem fallback 0 / null
export function normalizeWindsorRecord(raw: WindsorRawRecord): WindsorNormalizedRecord {
  // Prioridade: campo achatado Windsor (validado) → escalar legado → array actions (fallback)
  const leads =
    safeNum(raw.actions_onsite_conversion_lead_grouped) ||
    safeNum(raw.leads) ||
    extractFromActions(raw.actions, LEAD_ACTION_TYPES);

  const messages_started =
    safeNum(raw.actions_onsite_conversion_messaging_conversation_started_7d) ||
    safeNum(raw.messages_started) ||
    extractFromActions(raw.actions, MESSAGE_ACTION_TYPES);

  const purchases =
    safeNum(raw.actions_offsite_conversion_fb_pixel_purchase) ||
    safeNum(raw.purchases) ||
    extractFromActions(raw.actions, PURCHASE_ACTION_TYPES);

  const purchase_value =
    safeNum(raw.action_values_offsite_conversion_fb_pixel_purchase) ||
    safeNum(raw.purchase_value) ||
    extractFromActions(raw.action_values, PURCHASE_ACTION_TYPES);

  const spend = safeNum(raw.spend);
  // ROAS recalculado de purchase_value/spend quando há purchase_value; fallback para scalar Windsor
  const roas = purchase_value > 0 && spend > 0
    ? purchase_value / spend
    : safeNum(raw.roas);

  return {
    date: safeStr(raw.date) ?? new Date().toISOString().slice(0, 10),
    account_id: safeStr(raw.account_id),
    account_name: safeStr(raw.account_name),
    campaign_id: safeStr(raw.campaign_id),
    // Windsor retorna 'campaign' no conector /all; 'campaign_name' é fallback para outros conectores
    campaign_name: safeStr(raw.campaign ?? raw.campaign_name),
    adset_id: safeStr(raw.adset_id),
    adset_name: safeStr(raw.adset_name),
    ad_id: safeStr(raw.ad_id),
    ad_name: safeStr(raw.ad_name),
    spend,
    impressions: safeNum(raw.impressions),
    reach: safeNum(raw.reach),
    clicks: safeNum(raw.clicks),
    ctr: safeNum(raw.ctr),
    cpc: safeNum(raw.cpc),
    cpm: safeNum(raw.cpm),
    messages_started,
    leads,
    purchases,
    purchase_value,
    roas,
    engagements: safeNum(raw.engagements),
    video_views_25: safeNum(raw.video_views_25),
    video_views_75: safeNum(raw.video_views_75),
    frequency: safeNum(raw.frequency),
    raw_data: raw as Record<string, unknown>,
  };
}

// Normaliza um array de registros brutos Windsor
export function normalizeWindsorRecords(
  records: WindsorRawRecord[]
): WindsorNormalizedRecord[] {
  return records.map(normalizeWindsorRecord);
}

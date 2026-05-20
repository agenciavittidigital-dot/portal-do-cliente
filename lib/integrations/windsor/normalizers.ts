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

// Normaliza um registro bruto Windsor → formato performance_daily
// Nunca lança exceção: campos ausentes recebem fallback 0 / null
export function normalizeWindsorRecord(raw: WindsorRawRecord): WindsorNormalizedRecord {
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
    spend: safeNum(raw.spend),
    impressions: safeNum(raw.impressions),
    reach: safeNum(raw.reach),
    clicks: safeNum(raw.clicks),
    ctr: safeNum(raw.ctr),
    cpc: safeNum(raw.cpc),
    cpm: safeNum(raw.cpm),
    messages_started: safeNum(raw.messages_started),
    leads: safeNum(raw.leads),
    purchases: safeNum(raw.purchases),
    purchase_value: safeNum(raw.purchase_value),
    roas: safeNum(raw.roas),
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

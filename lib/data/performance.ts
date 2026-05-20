import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PerformanceData, PerformanceRow, PerformanceSummary } from "@/types";

// ── Cálculo do intervalo de datas ─────────────────────────────────────────────

export function computeDateRange(
  period: string,
  startDate?: string,
  endDate?: string
): { start: string; end: string } {
  const now = new Date();
  const fmt = (d: Date): string => d.toISOString().slice(0, 10);
  const ago = (days: number): Date => {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - days);
    return d;
  };

  switch (period) {
    case "today":
      return { start: fmt(now), end: fmt(now) };
    case "yesterday":
      return { start: fmt(ago(1)), end: fmt(ago(1)) };
    case "last_7_days":
      return { start: fmt(ago(6)), end: fmt(now) };
    case "last_14_days":
      return { start: fmt(ago(13)), end: fmt(now) };
    case "last_30_days":
      return { start: fmt(ago(29)), end: fmt(now) };
    case "this_month": {
      const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      return { start: fmt(first), end: fmt(now) };
    }
    case "last_month": {
      const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
      return { start: fmt(first), end: fmt(last) };
    }
    case "custom":
      if (startDate && endDate) return { start: startDate, end: endDate };
      return { start: fmt(ago(6)), end: fmt(now) };
    default:
      return { start: fmt(ago(6)), end: fmt(now) };
  }
}

// ── Loader de performance ─────────────────────────────────────────────────────

export async function loadPerformanceData(
  clientId: string,
  channel: string,
  startDate: string,
  endDate: string
): Promise<PerformanceData | null> {
  try {
    const admin = createAdminClient();

    const { data: rawRows, error } = await admin
      .from("performance_daily")
      .select(
        "date, spend, impressions, reach, clicks, ctr, cpc, cpm, messages_started, leads, purchases, purchase_value, roas, engagements, video_views_25, video_views_75, frequency"
      )
      .eq("client_id", clientId)
      .eq("channel", channel)
      .gte("date", startDate)
      .lte("date", endDate);

    if (error || !rawRows?.length) return null;

    // Soma métricas base; recalcula derivadas para evitar médias de médias
    const s = (key: string) =>
      rawRows.reduce((acc, r) => acc + (Number((r as Record<string, unknown>)[key]) || 0), 0);

    const totalSpend = s("spend");
    const totalImpressions = s("impressions");
    const totalReach = s("reach");
    const totalClicks = s("clicks");
    const totalLeads = s("leads");
    const totalPurchaseValue = s("purchase_value");

    const summary: PerformanceSummary = {
      spend: totalSpend,
      impressions: totalImpressions,
      reach: totalReach,
      frequency: totalReach > 0 ? totalImpressions / totalReach : null,
      clicks: totalClicks,
      ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : null,
      cpc: totalClicks > 0 ? totalSpend / totalClicks : null,
      cpm: totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : null,
      leads: totalLeads,
      cost_per_lead: totalLeads > 0 ? totalSpend / totalLeads : null,
      messages_started: s("messages_started"),
      purchases: s("purchases"),
      purchase_value: totalPurchaseValue,
      roas: totalSpend > 0 ? totalPurchaseValue / totalSpend : null,
      engagements: s("engagements"),
      video_views_25: s("video_views_25"),
      video_views_75: s("video_views_75"),
    };

    // Processa linhas individuais com métricas derivadas por dia
    const rows: PerformanceRow[] = rawRows
      .map((raw) => {
        const r = raw as Record<string, unknown>;
        const spend = Number(r.spend) || 0;
        const impressions = Number(r.impressions) || 0;
        const reach = Number(r.reach) || 0;
        const clicks = Number(r.clicks) || 0;
        const leads = Number(r.leads) || 0;
        return {
          date: String(r.date),
          spend,
          impressions,
          reach,
          clicks,
          messages_started: Number(r.messages_started) || 0,
          leads,
          purchases: Number(r.purchases) || 0,
          purchase_value: Number(r.purchase_value) || 0,
          engagements: Number(r.engagements) || 0,
          video_views_25: Number(r.video_views_25) || 0,
          video_views_75: Number(r.video_views_75) || 0,
          ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
          cpc: clicks > 0 ? spend / clicks : null,
          cpm: impressions > 0 ? (spend / impressions) * 1000 : null,
          frequency: reach > 0 ? impressions / reach : null,
          cost_per_lead: leads > 0 ? spend / leads : null,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    return { summary, rows };
  } catch (err) {
    console.error("[loadPerformanceData] Erro:", err);
    return null;
  }
}

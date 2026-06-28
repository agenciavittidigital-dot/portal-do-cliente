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
        "date, spend, impressions, reach, clicks, ctr, cpc, cpm, messages_started, leads, purchases, purchase_value, roas, engagements, video_views_25, video_views_75, frequency, landing_page_views"
      )
      .eq("client_id", clientId)
      .eq("channel", channel)
      .gte("date", startDate)
      .lte("date", endDate)
      .not("account_name", "ilike", "%demo%")
      .not("campaign_id", "ilike", "%demo%");

    if (error || !rawRows?.length) return null;

    // Soma métricas base; recalcula derivadas para evitar médias de médias
    const s = (key: string) =>
      rawRows.reduce((acc, r) => acc + (Number((r as Record<string, unknown>)[key]) || 0), 0);

    const totalSpend = s("spend");
    const totalImpressions = s("impressions");
    const totalReach = s("reach");
    const totalClicks = s("clicks");
    const totalLeads = s("leads");
    const totalMessages = s("messages_started");
    const totalPurchases = s("purchases");
    const totalPurchaseValue = s("purchase_value");
    const totalLandingPageViews = s("landing_page_views");

    // ROAS: média ponderada por spend dos valores armazenados pela Windsor.
    // Quando purchase_value = 0 mas Windsor retornou roas escalar, usa o valor Windsor.
    const roasWeightedSum = rawRows.reduce((acc, r) => {
      const roasVal = Number((r as Record<string, unknown>).roas) || 0;
      const spendVal = Number((r as Record<string, unknown>).spend) || 0;
      return acc + roasVal * spendVal;
    }, 0);

    const summary: PerformanceSummary = {
      spend: totalSpend,
      impressions: totalImpressions,
      reach: totalReach,
      frequency: totalReach > 0 ? totalImpressions / totalReach : null,
      clicks: totalClicks,
      ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : null,
      cpc: totalClicks > 0 ? totalSpend / totalClicks : null,
      cpm: totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : null,
      // Métricas de conversão: null quando Windsor não retornou dados (sum = 0)
      leads: totalLeads > 0 ? totalLeads : null,
      cost_per_lead: totalLeads > 0 ? totalSpend / totalLeads : null,
      messages_started: totalMessages > 0 ? totalMessages : null,
      cost_per_message: totalMessages > 0 ? totalSpend / totalMessages : null,
      purchases: totalPurchases > 0 ? totalPurchases : null,
      cost_per_purchase: totalPurchases > 0 ? totalSpend / totalPurchases : null,
      purchase_value: totalPurchaseValue > 0 ? totalPurchaseValue : null,
      roas: totalPurchaseValue > 0 && totalSpend > 0
        ? totalPurchaseValue / totalSpend
        : roasWeightedSum > 0 && totalSpend > 0
        ? roasWeightedSum / totalSpend
        : null,
      engagements: s("engagements"),
      video_views_25: s("video_views_25"),
      video_views_75: s("video_views_75"),
      landing_page_views: totalLandingPageViews > 0 ? totalLandingPageViews : null,
    };

    // Agrega múltiplas linhas por data (uma por campanha após Windsor sync)
    // em um único PerformanceRow por dia, somando métricas e recalculando derivadas.
    // Isso garante que gráfico e tabela recebam sempre um ponto por data.
    const byDate = new Map<string, PerformanceRow>();

    for (const raw of rawRows) {
      const r = raw as Record<string, unknown>;
      const date = String(r.date);
      const spend = Number(r.spend) || 0;
      const impressions = Number(r.impressions) || 0;
      const reach = Number(r.reach) || 0;
      const clicks = Number(r.clicks) || 0;
      const leads = Number(r.leads) || 0;
      const messages_started = Number(r.messages_started) || 0;
      const purchases = Number(r.purchases) || 0;
      const purchase_value = Number(r.purchase_value) || 0;
      const engagements = Number(r.engagements) || 0;
      const video_views_25 = Number(r.video_views_25) || 0;
      const video_views_75 = Number(r.video_views_75) || 0;
      const landing_page_views = Number(r.landing_page_views) || 0;

      const existing = byDate.get(date);
      if (existing) {
        existing.spend += spend;
        existing.impressions += impressions;
        existing.reach += reach;
        existing.clicks += clicks;
        existing.leads += leads;
        existing.messages_started += messages_started;
        existing.purchases += purchases;
        existing.purchase_value += purchase_value;
        existing.engagements += engagements;
        existing.video_views_25 += video_views_25;
        existing.video_views_75 += video_views_75;
        existing.landing_page_views += landing_page_views;
        // Recalcula derivadas com os totais acumulados do dia
        existing.ctr = existing.impressions > 0 ? (existing.clicks / existing.impressions) * 100 : null;
        existing.cpc = existing.clicks > 0 ? existing.spend / existing.clicks : null;
        existing.cpm = existing.impressions > 0 ? (existing.spend / existing.impressions) * 1000 : null;
        existing.frequency = existing.reach > 0 ? existing.impressions / existing.reach : null;
        existing.cost_per_lead = existing.leads > 0 ? existing.spend / existing.leads : null;
      } else {
        byDate.set(date, {
          date,
          spend,
          impressions,
          reach,
          clicks,
          messages_started,
          leads,
          purchases,
          purchase_value,
          engagements,
          video_views_25,
          video_views_75,
          landing_page_views,
          ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
          cpc: clicks > 0 ? spend / clicks : null,
          cpm: impressions > 0 ? (spend / impressions) * 1000 : null,
          frequency: reach > 0 ? impressions / reach : null,
          cost_per_lead: leads > 0 ? spend / leads : null,
        });
      }
    }

    const rows: PerformanceRow[] = [...byDate.values()].sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    return { summary, rows };
  } catch (err) {
    console.error("[loadPerformanceData] Erro:", err);
    return null;
  }
}

// ── Criativos Meta Ads (agrupados por campanha, com thumbnail) ────────────────

export interface CreativeRow {
  adId: string;
  adName: string | null;
  campaignId: string;
  campaignName: string | null;
  thumbnail_url: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  messages_started: number;
  cost_per_lead: number | null;
  cost_per_message: number | null;
}

export async function loadCreativesData(
  clientId: string,
  startDate: string,
  endDate: string
): Promise<CreativeRow[]> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("performance_daily")
      .select("ad_id, ad_name, campaign_id, campaign_name, thumbnail_url, spend, impressions, clicks, leads, messages_started")
      .eq("client_id", clientId)
      .eq("channel", "meta_ads")
      .gte("date", startDate)
      .lte("date", endDate)
      .not("account_name", "ilike", "%demo%")
      .not("campaign_id", "ilike", "%demo%");

    if (error || !data?.length) return [];

    type CreativeAccum = {
      adName: string | null;
      campaignId: string;
      campaignName: string | null;
      thumbnail_url: string | null;
      spend: number;
      impressions: number;
      clicks: number;
      leads: number;
      messages_started: number;
    };
    const byId = new Map<string, CreativeAccum>();

    for (const row of data) {
      const r = row as Record<string, unknown>;
      const campaignId = String(r.campaign_id ?? "unknown");
      // Usa ad_id real quando disponível; fallback para campaign_id (dados pré-ad-level)
      const rawAdId = String(r.ad_id ?? "");
      const id =
        rawAdId && rawAdId !== "unknown" ? rawAdId : campaignId;

      const spend = Number(r.spend) || 0;
      const impressions = Number(r.impressions) || 0;
      const clicks = Number(r.clicks) || 0;
      const leads = Number(r.leads) || 0;
      const messages_started = Number(r.messages_started) || 0;
      const thumb = r.thumbnail_url ? String(r.thumbnail_url) : null;

      const existing = byId.get(id);
      if (existing) {
        existing.spend += spend;
        existing.impressions += impressions;
        existing.clicks += clicks;
        existing.leads += leads;
        existing.messages_started += messages_started;
        if (!existing.thumbnail_url && thumb) existing.thumbnail_url = thumb;
      } else {
        const camName = r.campaign_name;
        const adNameRaw = r.ad_name;
        byId.set(id, {
          adName: typeof adNameRaw === "string" && adNameRaw ? adNameRaw : null,
          campaignId,
          campaignName: typeof camName === "string" && camName ? camName : null,
          thumbnail_url: thumb,
          spend,
          impressions,
          clicks,
          leads,
          messages_started,
        });
      }
    }

    return [...byId.entries()].map(([adId, c]) => ({
      adId,
      adName: c.adName,
      campaignId: c.campaignId,
      campaignName: c.campaignName,
      thumbnail_url: c.thumbnail_url,
      spend: c.spend,
      impressions: c.impressions,
      clicks: c.clicks,
      leads: c.leads,
      messages_started: c.messages_started,
      cost_per_lead: c.leads > 0 ? c.spend / c.leads : null,
      cost_per_message: c.messages_started > 0 ? c.spend / c.messages_started : null,
    }));
  } catch {
    return [];
  }
}

// ── Loader de campanhas Google Ads ────────────────────────────────────────────

export interface GoogleAdsCampaignRow {
  campaignId: string;
  campaignName: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  ctr: number | null;
  cpc: number | null;
  costPerLead: number | null;
}

export async function loadGoogleAdsCampaigns(
  clientId: string,
  startDate: string,
  endDate: string
): Promise<GoogleAdsCampaignRow[]> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("performance_daily")
      .select("campaign_id, campaign_name, spend, impressions, clicks, leads")
      .eq("client_id", clientId)
      .eq("channel", "google_ads")
      .gte("date", startDate)
      .lte("date", endDate);

    if (error || !data?.length) return [];

    const byId = new Map<string, { campaignName: string | null; spend: number; impressions: number; clicks: number; leads: number }>();
    for (const row of data) {
      const id = String((row as Record<string, unknown>).campaign_id ?? "unknown");
      const name = (row as Record<string, unknown>).campaign_name;
      const spend = Number((row as Record<string, unknown>).spend) || 0;
      const impressions = Number((row as Record<string, unknown>).impressions) || 0;
      const clicks = Number((row as Record<string, unknown>).clicks) || 0;
      const leads = Number((row as Record<string, unknown>).leads) || 0;

      const existing = byId.get(id);
      if (existing) {
        existing.spend += spend;
        existing.impressions += impressions;
        existing.clicks += clicks;
        existing.leads += leads;
      } else {
        byId.set(id, {
          campaignName: typeof name === "string" && name ? name : null,
          spend,
          impressions,
          clicks,
          leads,
        });
      }
    }

    return [...byId.entries()]
      .map(([campaignId, c]) => ({
        campaignId,
        campaignName: c.campaignName,
        spend: c.spend,
        impressions: c.impressions,
        clicks: c.clicks,
        leads: c.leads,
        ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : null,
        cpc: c.clicks > 0 ? c.spend / c.clicks : null,
        costPerLead: c.leads > 0 ? c.spend / c.leads : null,
      }))
      .sort((a, b) => b.spend - a.spend);
  } catch {
    return [];
  }
}

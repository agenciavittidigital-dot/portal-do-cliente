import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadUserContext } from "@/lib/data/user-context";
import { syncWindsorForPeriod } from "@/lib/integrations/windsor/sync";

// ── Helpers ───────────────────────────────────────────────────────────────────

function isSlugId(id: string): boolean {
  // Slug-based IDs gerados pelo sistema antigo: começam com letra, contêm underscores
  // IDs reais do Meta Ads: puramente numéricos (ex: "120213523456789")
  return /^[a-z]/.test(id);
}

function isRealId(id: string): boolean {
  return /^\d+$/.test(id);
}

interface MetricSnapshot {
  rowCount: number;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  ctr: number | null;
  purchases: number;
  purchase_value: number;
  cost_per_purchase: number | null;
  roas: number | null;
  campaignIds: Array<{
    campaignId: string;
    campaignName: string | null;
    idType: "real" | "slug" | "other";
    rowCount: number;
    spend: number;
    purchases: number;
    purchase_value: number;
  }>;
}

async function snapshotMetrics(
  clientId: string,
  dateFrom: string,
  dateTo: string
): Promise<MetricSnapshot> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("performance_daily")
    .select("campaign_id, campaign_name, spend, impressions, reach, clicks, purchases, purchase_value, roas")
    .eq("client_id", clientId)
    .eq("channel", "meta_ads")
    .gte("date", dateFrom)
    .lte("date", dateTo);

  if (error || !data?.length) {
    return {
      rowCount: 0,
      spend: 0,
      impressions: 0,
      reach: 0,
      clicks: 0,
      ctr: null,
      purchases: 0,
      purchase_value: 0,
      cost_per_purchase: null,
      roas: null,
      campaignIds: [],
    };
  }

  type Row = typeof data[number];

  let totalSpend = 0;
  let totalImpressions = 0;
  let totalReach = 0;
  let totalClicks = 0;
  let totalPurchases = 0;
  let totalPurchaseValue = 0;
  let roasWeightedSum = 0;

  const byCampaign = new Map<string, {
    campaignName: string | null;
    rowCount: number;
    spend: number;
    purchases: number;
    purchase_value: number;
  }>();

  for (const row of data as Row[]) {
    const r = row as Record<string, unknown>;
    const spend = Number(r.spend) || 0;
    const impressions = Number(r.impressions) || 0;
    const reach = Number(r.reach) || 0;
    const clicks = Number(r.clicks) || 0;
    const purchases = Number(r.purchases) || 0;
    const purchase_value = Number(r.purchase_value) || 0;
    const roas = Number(r.roas) || 0;

    totalSpend += spend;
    totalImpressions += impressions;
    totalReach += reach;
    totalClicks += clicks;
    totalPurchases += purchases;
    totalPurchaseValue += purchase_value;
    roasWeightedSum += roas * spend;

    const cid = String(r.campaign_id ?? "unknown");
    const existing = byCampaign.get(cid);
    if (existing) {
      existing.rowCount++;
      existing.spend += spend;
      existing.purchases += purchases;
      existing.purchase_value += purchase_value;
    } else {
      const cname = r.campaign_name;
      byCampaign.set(cid, {
        campaignName: typeof cname === "string" && cname ? cname : null,
        rowCount: 1,
        spend,
        purchases,
        purchase_value,
      });
    }
  }

  const campaignIds = [...byCampaign.entries()].map(([campaignId, c]) => ({
    campaignId,
    campaignName: c.campaignName,
    idType: (isRealId(campaignId) ? "real" : isSlugId(campaignId) ? "slug" : "other") as "real" | "slug" | "other",
    rowCount: c.rowCount,
    spend: c.spend,
    purchases: c.purchases,
    purchase_value: c.purchase_value,
  })).sort((a, b) => b.spend - a.spend);

  return {
    rowCount: data.length,
    spend: totalSpend,
    impressions: totalImpressions,
    reach: totalReach,
    clicks: totalClicks,
    ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : null,
    purchases: totalPurchases,
    purchase_value: totalPurchaseValue,
    cost_per_purchase: totalPurchases > 0 ? totalSpend / totalPurchases : null,
    roas: totalPurchaseValue > 0 && totalSpend > 0
      ? totalPurchaseValue / totalSpend
      : roasWeightedSum > 0 && totalSpend > 0
      ? roasWeightedSum / totalSpend
      : null,
    campaignIds,
  };
}

// ── POST /api/admin/windsor/extended-sync ─────────────────────────────────────

export async function POST(req: NextRequest): Promise<Response> {
  // Autenticação
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const ctx = await loadUserContext(user.id);
  if (!ctx.isAdmin) return NextResponse.json({ error: "Acesso restrito a administradores Vitti." }, { status: 403 });

  // Parse e validação do body
  let body: { clientId?: string; dateFrom?: string; dateTo?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido." }, { status: 400 });
  }

  const { clientId, dateFrom, dateTo } = body;

  if (!clientId || typeof clientId !== "string") {
    return NextResponse.json({ error: "clientId é obrigatório." }, { status: 400 });
  }
  if (!dateFrom || !dateTo || typeof dateFrom !== "string" || typeof dateTo !== "string") {
    return NextResponse.json({ error: "dateFrom e dateTo são obrigatórios (formato YYYY-MM-DD)." }, { status: 400 });
  }

  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(dateFrom) || !datePattern.test(dateTo)) {
    return NextResponse.json({ error: "Datas devem estar no formato YYYY-MM-DD." }, { status: 400 });
  }

  if (dateFrom > dateTo) {
    return NextResponse.json({ error: "dateFrom deve ser anterior ou igual a dateTo." }, { status: 400 });
  }

  // ── 1. Snapshot ANTES do sync ─────────────────────────────────────────────
  const before = await snapshotMetrics(clientId, dateFrom, dateTo);

  // ── 2. Executa o sync estendido ───────────────────────────────────────────
  const syncResult = await syncWindsorForPeriod({ clientId, dateFrom, dateTo });

  // ── 3. Snapshot APÓS o sync ───────────────────────────────────────────────
  const after = await snapshotMetrics(clientId, dateFrom, dateTo);

  // ── 4. Análise de registros legados (slugs) ───────────────────────────────
  // Identifica campaign_ids em formato slug que coexistem com IDs reais no período.
  // NÃO deleta nada — apenas informa para decisão do usuário.

  const slugCampaigns = after.campaignIds.filter((c) => c.idType === "slug");
  const realCampaigns = after.campaignIds.filter((c) => c.idType === "real");

  // Tenta inferir quais slugs seriam substituídos por quais IDs reais
  // com base no nome da campanha (comparação aproximada)
  const legacyAnalysis = slugCampaigns.map((slug) => {
    // Busca real ID com nome mais próximo (simplificado: começa com o mesmo trecho)
    const slugName = slug.campaignName?.toLowerCase() ?? "";
    const matchingReal = realCampaigns.find((r) => {
      const realName = r.campaignName?.toLowerCase() ?? "";
      return realName && slugName && (realName.startsWith(slugName) || slugName.startsWith(realName));
    }) ?? null;

    return {
      slugCampaignId: slug.campaignId,
      campaignName: slug.campaignName,
      rowCount: slug.rowCount,
      spend: slug.spend,
      purchases: slug.purchases,
      purchase_value: slug.purchase_value,
      likelyReplacedBy: matchingReal
        ? { realCampaignId: matchingReal.campaignId, campaignName: matchingReal.campaignName }
        : null,
    };
  });

  const hasRealIdsNow = realCampaigns.length > 0;
  const readyForCleanup = hasRealIdsNow && slugCampaigns.length > 0;

  return NextResponse.json({
    success: syncResult.success,
    period: { from: dateFrom, to: dateTo },
    clientId,

    before: {
      rowCount: before.rowCount,
      totals: {
        spend: before.spend,
        impressions: before.impressions,
        reach: before.reach,
        clicks: before.clicks,
        ctr: before.ctr,
        purchases: before.purchases,
        purchase_value: before.purchase_value,
        cost_per_purchase: before.cost_per_purchase,
        roas: before.roas,
      },
      campaignIds: before.campaignIds,
      slugCount: before.campaignIds.filter((c) => c.idType === "slug").length,
      realCount: before.campaignIds.filter((c) => c.idType === "real").length,
    },

    syncResult: {
      fetched: syncResult.totalFetched,
      mapped: syncResult.mappedRecords,
      grouped: syncResult.groupedRecords,
      upserted: syncResult.upserted,
      skipped: syncResult.skippedUnmapped,
      error: syncResult.error,
      errorDetail: syncResult.errorDetail,
    },

    after: {
      rowCount: after.rowCount,
      totals: {
        spend: after.spend,
        impressions: after.impressions,
        reach: after.reach,
        clicks: after.clicks,
        ctr: after.ctr,
        purchases: after.purchases,
        purchase_value: after.purchase_value,
        cost_per_purchase: after.cost_per_purchase,
        roas: after.roas,
      },
      campaignIds: after.campaignIds,
      slugCount: after.campaignIds.filter((c) => c.idType === "slug").length,
      realCount: after.campaignIds.filter((c) => c.idType === "real").length,
    },

    // Análise de legados — aguardando autorização para limpeza
    legacy: {
      slugCampaigns: legacyAnalysis,
      totalSlugRowCount: slugCampaigns.reduce((sum, c) => sum + c.rowCount, 0),
      totalSlugSpend: slugCampaigns.reduce((sum, c) => sum + c.spend, 0),
      readyForCleanup,
      cleanupNote: readyForCleanup
        ? "IDs reais encontrados. Legados podem ser removidos após confirmação manual."
        : slugCampaigns.length === 0
        ? "Nenhum registro legacy encontrado no período."
        : "IDs reais não encontrados — Windsor pode não ter retornado campaign_id para este período.",
    },

    ...(syncResult.error ? { error: syncResult.error } : {}),
  });
}

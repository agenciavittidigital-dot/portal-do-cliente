import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import {
  getMetaIntegrationToken,
  getMetaIntegrationById,
} from "@/lib/data/meta-integrations";
import { createMetaClient } from "@/lib/integrations/meta/client";
import {
  extractFromActions,
  LEAD_ACTION_TYPES,
  PURCHASE_ACTION_TYPES,
  ADD_TO_CART_ACTION_TYPES,
  INITIATE_CHECKOUT_ACTION_TYPES,
} from "@/lib/integrations/windsor/normalizers";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MetaInsightRaw } from "@/lib/integrations/meta/types";

// ── Helpers ────────────────────────────────────────────────────────────────────

function safeNum(val: unknown): number {
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

// ── Tipos internos ─────────────────────────────────────────────────────────────

interface DayTotals {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  leads: number;
  add_to_cart: number;
  initiate_checkout: number;
  purchases: number;
  purchase_value: number;
}

function emptyDay(): DayTotals {
  return {
    spend: 0,
    impressions: 0,
    reach: 0,
    clicks: 0,
    leads: 0,
    add_to_cart: 0,
    initiate_checkout: 0,
    purchases: 0,
    purchase_value: 0,
  };
}

// ── Normalização Meta em memória ───────────────────────────────────────────────
// Agrega registros por dia; reutiliza extractFromActions do Windsor para evitar
// double-counting (ex: purchase vs offsite_conversion.fb_pixel_purchase).
// reach somado por ad-level pode incluir overlap entre ads — reportado como warning.

function normalizeMetaInsights(records: MetaInsightRaw[]): {
  byDay: Map<string, DayTotals>;
  campaignIds: Set<string>;
  adsetIds: Set<string>;
  adIds: Set<string>;
  actionTypesFound: Set<string>;
} {
  const byDay = new Map<string, DayTotals>();
  const campaignIds = new Set<string>();
  const adsetIds = new Set<string>();
  const adIds = new Set<string>();
  const actionTypesFound = new Set<string>();

  for (const r of records) {
    const date = r.date_start ?? "";
    if (!date) continue;

    if (r.campaign_id) campaignIds.add(r.campaign_id);
    if (r.adset_id) adsetIds.add(r.adset_id);
    if (r.ad_id) adIds.add(r.ad_id);

    for (const a of r.actions ?? []) actionTypesFound.add(a.action_type);
    for (const a of r.action_values ?? []) actionTypesFound.add(a.action_type);

    const leads = extractFromActions(r.actions, LEAD_ACTION_TYPES);
    const add_to_cart = extractFromActions(r.actions, ADD_TO_CART_ACTION_TYPES);
    const initiate_checkout = extractFromActions(r.actions, INITIATE_CHECKOUT_ACTION_TYPES);
    const purchases = extractFromActions(r.actions, PURCHASE_ACTION_TYPES);
    const purchase_value = extractFromActions(r.action_values, PURCHASE_ACTION_TYPES);

    const existing = byDay.get(date);
    if (existing) {
      existing.spend += safeNum(r.spend);
      existing.impressions += safeNum(r.impressions);
      existing.reach += safeNum(r.reach);
      existing.clicks += safeNum(r.clicks);
      existing.leads += leads;
      existing.add_to_cart += add_to_cart;
      existing.initiate_checkout += initiate_checkout;
      existing.purchases += purchases;
      existing.purchase_value += purchase_value;
    } else {
      byDay.set(date, {
        spend: safeNum(r.spend),
        impressions: safeNum(r.impressions),
        reach: safeNum(r.reach),
        clicks: safeNum(r.clicks),
        leads,
        add_to_cart,
        initiate_checkout,
        purchases,
        purchase_value,
      });
    }
  }

  return { byDay, campaignIds, adsetIds, adIds, actionTypesFound };
}

// ── Windsor: lê performance_daily por dia ─────────────────────────────────────
// Leitura somente — não grava nada.

async function loadWindsorDailyTotals(
  clientId: string,
  dateFrom: string,
  dateTo: string
): Promise<Map<string, DayTotals>> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("performance_daily")
    .select(
      "date, spend, impressions, reach, clicks, leads, add_to_cart, initiate_checkout, purchases, purchase_value"
    )
    .eq("client_id", clientId)
    .eq("channel", "meta_ads")
    .gte("date", dateFrom)
    .lte("date", dateTo)
    .not("account_name", "ilike", "%demo%");

  if (error || !data?.length) return new Map();

  const byDay = new Map<string, DayTotals>();
  for (const row of data) {
    const r = row as Record<string, unknown>;
    const date = String(r.date);
    const existing = byDay.get(date);
    if (existing) {
      existing.spend += safeNum(r.spend);
      existing.impressions += safeNum(r.impressions);
      existing.reach += safeNum(r.reach);
      existing.clicks += safeNum(r.clicks);
      existing.leads += safeNum(r.leads);
      existing.add_to_cart += safeNum(r.add_to_cart);
      existing.initiate_checkout += safeNum(r.initiate_checkout);
      existing.purchases += safeNum(r.purchases);
      existing.purchase_value += safeNum(r.purchase_value);
    } else {
      byDay.set(date, {
        spend: safeNum(r.spend),
        impressions: safeNum(r.impressions),
        reach: safeNum(r.reach),
        clicks: safeNum(r.clicks),
        leads: safeNum(r.leads),
        add_to_cart: safeNum(r.add_to_cart),
        initiate_checkout: safeNum(r.initiate_checkout),
        purchases: safeNum(r.purchases),
        purchase_value: safeNum(r.purchase_value),
      });
    }
  }
  return byDay;
}

// ── Auto-detecta período com dados Windsor existentes ─────────────────────────
// Pega a data mais recente e usa os 7 dias anteriores como janela.

async function detectWindsorPeriod(
  clientId: string
): Promise<{ dateFrom: string; dateTo: string } | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("performance_daily")
    .select("date")
    .eq("client_id", clientId)
    .eq("channel", "meta_ads")
    .not("account_name", "ilike", "%demo%")
    .order("date", { ascending: false })
    .limit(1);

  if (!data?.length) return null;

  const latestDate = String((data[0] as Record<string, unknown>).date);
  const latest = new Date(latestDate + "T00:00:00Z");
  const from = new Date(latest);
  from.setUTCDate(from.getUTCDate() - 6);

  return {
    dateFrom: from.toISOString().slice(0, 10),
    dateTo: latestDate,
  };
}

// ── Helpers de comparação ──────────────────────────────────────────────────────

function absDiff(meta: number, windsor: number): number {
  return Math.round((meta - windsor) * 100) / 100;
}

function pctDiff(meta: number, windsor: number): number | null {
  if (windsor === 0) return null;
  return Math.round(((meta - windsor) / windsor) * 10000) / 100;
}

function sumTotals(byDay: Map<string, DayTotals>): DayTotals {
  const t = emptyDay();
  for (const d of byDay.values()) {
    t.spend += d.spend;
    t.impressions += d.impressions;
    t.reach += d.reach;
    t.clicks += d.clicks;
    t.leads += d.leads;
    t.add_to_cart += d.add_to_cart;
    t.initiate_checkout += d.initiate_checkout;
    t.purchases += d.purchases;
    t.purchase_value += d.purchase_value;
  }
  return t;
}

function buildComparison(meta: DayTotals, windsor: DayTotals) {
  const metrics = [
    "spend",
    "impressions",
    "reach",
    "clicks",
    "leads",
    "add_to_cart",
    "initiate_checkout",
    "purchases",
    "purchase_value",
  ] as const;

  return Object.fromEntries(
    metrics.map((k) => [
      k,
      {
        meta: meta[k],
        windsor: windsor[k],
        abs: absDiff(meta[k], windsor[k]),
        pct: pctDiff(meta[k], windsor[k]),
      },
    ])
  );
}

// ── Handler ────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Autenticação
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Não autenticado." },
      { status: 401 }
    );
  }

  // Autorização
  const ctx = await loadUserContext(user.id);
  if (!ctx.isAdmin) {
    return NextResponse.json(
      { success: false, error: "Acesso restrito a administradores Vitti." },
      { status: 403 }
    );
  }

  // Body
  let body: { integrationId?: unknown; dateFrom?: unknown; dateTo?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Body inválido — JSON esperado." },
      { status: 400 }
    );
  }

  const { integrationId, dateFrom: bodyDateFrom, dateTo: bodyDateTo } = body;

  if (!integrationId || typeof integrationId !== "string" || !integrationId.trim()) {
    return NextResponse.json(
      { success: false, error: "integrationId é obrigatório." },
      { status: 400 }
    );
  }

  // Buscar integração — somente colunas seguras, sem token
  const integration = await getMetaIntegrationById(integrationId.trim());
  if (!integration) {
    return NextResponse.json(
      { success: false, error: "Integração não encontrada ou não é meta_direct." },
      { status: 404 }
    );
  }

  // Descriptografar token server-side — token nunca entra na resposta
  const accessToken = await getMetaIntegrationToken(integrationId.trim());
  if (!accessToken) {
    return NextResponse.json(
      { success: false, error: "Não foi possível recuperar o token desta integração." },
      { status: 500 }
    );
  }

  const client = createMetaClient({ accessToken });
  const warnings: string[] = [];

  // Buscar detalhes completos da conta Meta
  const accountDetails = await client.fetchAccountDetails(integration.account_id);
  if (!accountDetails) {
    warnings.push(
      "Não foi possível obter detalhes completos da conta (currency/timezone). Continuando com dados básicos da integração."
    );
  }

  // Determinar período
  let dateFrom: string;
  let dateTo: string;
  let periodSource: string;

  const hasExplicitDates =
    typeof bodyDateFrom === "string" &&
    typeof bodyDateTo === "string" &&
    bodyDateFrom.trim() &&
    bodyDateTo.trim();

  if (hasExplicitDates) {
    dateFrom = (bodyDateFrom as string).trim();
    dateTo = (bodyDateTo as string).trim();
    periodSource = "explicit";
  } else {
    const detected = await detectWindsorPeriod(integration.client_id);
    if (detected) {
      dateFrom = detected.dateFrom;
      dateTo = detected.dateTo;
      periodSource = "auto_detected_from_windsor";
    } else {
      const now = new Date();
      dateTo = now.toISOString().slice(0, 10);
      const from = new Date(now);
      from.setUTCDate(from.getUTCDate() - 6);
      dateFrom = from.toISOString().slice(0, 10);
      periodSource = "fallback_last_7_days";
      warnings.push(
        "Nenhum dado Windsor encontrado em performance_daily para este cliente. Usando os últimos 7 dias como período default."
      );
    }
  }

  // Campos obrigatórios dos insights
  const REQUIRED_FIELDS = [
    "date_start",
    "date_stop",
    "account_id",
    "account_name",
    "campaign_id",
    "campaign_name",
    "adset_id",
    "adset_name",
    "ad_id",
    "ad_name",
    "spend",
    "impressions",
    "reach",
    "clicks",
    "frequency",
    "ctr",
    "cpc",
    "cpm",
    "actions",
    "action_values",
    "purchase_roas",
  ].join(",");

  const OPTIONAL_FIELDS = ["video_p25_watched_actions", "video_p75_watched_actions"];

  const insightParams: Record<string, string> = {
    level: "ad",
    time_increment: "1",
    time_range: JSON.stringify({ since: dateFrom, until: dateTo }),
    fields: `${REQUIRED_FIELDS},${OPTIONAL_FIELDS.join(",")}`,
    limit: "500",
  };

  // Primeira tentativa com todos os campos (obrigatórios + opcionais de vídeo)
  let fetchResult = await client.fetchInsightsPaginated(
    integration.account_id,
    insightParams
  );

  // Se falhou e tínhamos campos opcionais, tenta sem eles
  let removedOptionalFields: string[] = [];
  if (fetchResult.error) {
    removedOptionalFields = [...OPTIONAL_FIELDS];
    warnings.push(
      `Primeiro fetch falhou: "${fetchResult.error}". Removendo campos opcionais (${OPTIONAL_FIELDS.join(", ")}) e tentando novamente.`
    );
    insightParams.fields = REQUIRED_FIELDS;
    fetchResult = await client.fetchInsightsPaginated(
      integration.account_id,
      insightParams
    );

    if (fetchResult.error) {
      return NextResponse.json(
        {
          success: false,
          error: `Falha ao buscar insights Meta mesmo sem campos opcionais: ${fetchResult.error}`,
          warnings,
        },
        { status: 502 }
      );
    }
  }

  // Normalizar Meta em memória
  const { byDay: metaByDay, campaignIds, adsetIds, adIds, actionTypesFound } =
    normalizeMetaInsights(fetchResult.records);

  // Warning: reach somado no nível de ad pode ter overlap entre anúncios
  if (metaByDay.size > 0) {
    warnings.push(
      "reach somado no nível de ad (level=ad) pode incluir overlap: a mesma pessoa pode ter sido alcançada por múltiplos anúncios no mesmo dia. Divergências de reach vs Windsor são esperadas."
    );
  }

  // Carregar dados Windsor para comparação (somente leitura)
  const windsorByDay = await loadWindsorDailyTotals(
    integration.client_id,
    dateFrom,
    dateTo
  );

  if (windsorByDay.size === 0) {
    warnings.push(
      "Nenhum dado Windsor encontrado em performance_daily para este cliente/período. Comparação Windsor vs Meta não disponível."
    );
  }

  // Totais do período
  const metaTotals = sumTotals(metaByDay);
  const windsorTotals = sumTotals(windsorByDay);

  // Comparação total
  const totalComparison = buildComparison(metaTotals, windsorTotals);

  // Comparação diária
  const allDates = new Set([...metaByDay.keys(), ...windsorByDay.keys()]);
  const dailyComparison = [...allDates].sort().map((date) => {
    const m = metaByDay.get(date) ?? emptyDay();
    const w = windsorByDay.get(date) ?? emptyDay();
    return {
      date,
      meta: { ...m },
      windsor: { ...w },
      diff: buildComparison(m, w),
    };
  });

  // Possíveis causas de divergência
  const divergenceNotes = [
    "attribution_window: Windsor e Meta podem usar janelas de atribuição diferentes (ex: 7d click vs 1d click).",
    "action_report_time: Meta pode usar impression_time ou conversion_time — Windsor pode usar outro padrão.",
    "timezone: se Meta conta retorna dados em UTC e Windsor usa outro fuso, datas podem não coincidir.",
    "conversoes_modeladas: Meta aplica modelagem estatística em conversões que não podem ser medidas diretamente (iOS 14+).",
    "granularidade: Windsor agrega campanhas antes de gravar; Meta retorna por anúncio (level=ad). Aggregation diferente pode causar pequenas diferenças.",
    "dados_retroativos: Meta pode atualizar conversões retroativamente (janela de 28 dias). Dados Windsor são snapshot do momento do sync.",
  ];

  return NextResponse.json({
    success: true,
    account: accountDetails ?? {
      account_id: integration.account_id,
      account_name: integration.account_name,
      account_status: null,
      account_status_label: "Não carregado",
      currency: null,
      timezone_name: null,
      timezone_offset_hours_utc: null,
    },
    period: {
      dateFrom,
      dateTo,
      source: periodSource,
    },
    pagination: {
      pages: fetchResult.pages,
      totalRecords: fetchResult.records.length,
    },
    ids: {
      campaigns: campaignIds.size,
      adsets: adsetIds.size,
      ads: adIds.size,
    },
    fieldsRequested: insightParams.fields.split(","),
    removedOptionalFields: removedOptionalFields.length > 0 ? removedOptionalFields : [],
    actionTypesFound: [...actionTypesFound].sort(),
    metaTotals,
    windsorTotals,
    totalComparison,
    dailyComparison,
    divergenceNotes,
    warnings: warnings.length > 0 ? warnings : [],
  });
}

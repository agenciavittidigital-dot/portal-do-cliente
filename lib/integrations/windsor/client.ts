import "server-only";
import type {
  WindsorApiResponse,
  WindsorConnectedAccount,
  WindsorConnectedAccountsResponse,
  WindsorStatus,
} from "./types";

// Conector unificado da Windsor AI
const WINDSOR_ALL_ENDPOINT = "https://connectors.windsor.ai/all";

// Endpoint de listagem de contas conectadas — não depende de atividade/data
const WINDSOR_DS_ACCOUNTS_ENDPOINT = "https://onboard.windsor.ai/api/common/ds-accounts";

// Campos mínimos para o painel de preview
const WINDSOR_PREVIEW_FIELDS = [
  "date",
  "datasource",
  "account_name",
  "account_id",
  "source",
  "campaign",
  "clicks",
  "spend",
].join(",");

// Campos completos confirmados pela Sprint 6E-A — usados na sincronização
export const WINDSOR_SYNC_FIELDS = [
  "date",
  "datasource",
  "account_name",
  "account_id",
  "campaign_id",
  "source",
  "campaign",
  "clicks",
  "spend",
  "impressions",
  "reach",
  "frequency",
  "ctr",
  "cpc",
  "cpm",
  "leads",
  "messages_started",
  "purchases",
  "purchase_value",
  "roas",
  "engagements",
  "video_views_25",
  "video_views_75",
  // Conversões Meta Ads: campos achatados (nomes técnicos validados na Windsor)
  "actions_onsite_conversion_lead_grouped",
  "actions_onsite_conversion_messaging_conversation_started_7d",
  "actions_offsite_conversion_fb_pixel_purchase",
  "action_values_offsite_conversion_fb_pixel_purchase",
  // Arrays brutos (fallback — Windsor pode retornar via actions em vez de campos achatados)
  "actions",
  "action_values",
  // Criativo — thumbnail do anúncio
  "thumbnail_url",
  // Granularidade de anúncio individual
  "ad_id",
  "ad_name",
  // Page Views (aterrissagem confirmada no site)
  "actions_landing_page_view",
  // Objetivo da campanha (campo customizado Windsor)
  "wcf__objetivo",
] as const;

// Campos para o sync de breakdown demográfico (gênero e faixa etária)
// Separado de WINDSOR_SYNC_FIELDS — grava em performance_breakdowns, não em performance_daily
export const WINDSOR_DEMOGRAPHIC_FIELDS = [
  "date",
  "account_name",
  "gender",
  "age",
  "spend",
  "impressions",
  "reach",
  "clicks",
  "leads",
  "messages_started",
] as const;

// Campos para o sync de breakdown regional (região por estado/cidade)
// Separado de WINDSOR_SYNC_FIELDS — grava em performance_breakdowns, não em performance_daily
export const WINDSOR_REGIONAL_FIELDS = [
  "date",
  "account_name",
  "region",
  "spend",
  "impressions",
  "reach",
  "clicks",
  "leads",
  "messages_started",
] as const;

// Verifica se WINDSOR_API_KEY está presente no servidor
// Nunca expõe a chave completa — retorna versão mascarada para logs/UI
export function getWindsorStatus(): WindsorStatus {
  const apiKey = process.env.WINDSOR_API_KEY?.trim();
  if (!apiKey) {
    return { configured: false, reason: "WINDSOR_API_KEY não configurada no ambiente" };
  }
  // Exibe apenas primeiros 10 e últimos 4 caracteres para diagnóstico
  const masked =
    apiKey.length > 14
      ? `${apiKey.slice(0, 10)}...${apiKey.slice(-4)}`
      : `${apiKey.slice(0, 3)}...`;
  return { configured: true, maskedKey: masked };
}

async function fetchWindsor(
  fields: string,
  dates?: { dateFrom: string; dateTo: string }
): Promise<WindsorApiResponse> {
  const status = getWindsorStatus();
  if (!status.configured) {
    return { error: status.reason };
  }

  const url = new URL(WINDSOR_ALL_ENDPOINT);
  url.searchParams.set("api_key", process.env.WINDSOR_API_KEY!);
  url.searchParams.set("fields", fields);
  if (dates) {
    url.searchParams.set("date_from", dates.dateFrom);
    url.searchParams.set("date_to", dates.dateTo);
  } else {
    url.searchParams.set("date_preset", "last_7d");
  }

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      const rawBody = await res.text().catch(() => "");
      const safeBody = rawBody
        .replace(/api_key=[^\s&"']*/gi, "api_key=***")
        .slice(0, 300);
      return {
        error: `Windsor respondeu com HTTP ${res.status}`,
        errorDetail: safeBody || undefined,
      };
    }

    return res.json() as Promise<WindsorApiResponse>;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return { error: `Falha na conexão com Windsor: ${msg}` };
  }
}

// Preview: campos mínimos, sem gravar nada
export async function fetchWindsorRawData(): Promise<WindsorApiResponse> {
  return fetchWindsor(WINDSOR_PREVIEW_FIELDS);
}

// Sync: últimos 7 dias incluindo hoje (date_from/date_to explícito)
export async function fetchWindsorSyncData(): Promise<WindsorApiResponse> {
  const today = new Date();
  const dateTo = today.toISOString().slice(0, 10);
  const from = new Date(today);
  from.setUTCDate(from.getUTCDate() - 6);
  const dateFrom = from.toISOString().slice(0, 10);
  return fetchWindsor(WINDSOR_SYNC_FIELDS.join(","), { dateFrom, dateTo });
}

// Sync com período customizado — usado pelo endpoint de ressincronização estendida
export async function fetchWindsorSyncDataForRange(
  dateFrom: string,
  dateTo: string
): Promise<WindsorApiResponse> {
  return fetchWindsor(WINDSOR_SYNC_FIELDS.join(","), { dateFrom, dateTo });
}

// Lista contas conectadas ao workspace Windsor via endpoint dedicado.
// Usa autenticação por header X-Api-Key (chave nunca exposta em URL ou log).
// Não depende de atividade recente — retorna todas as contas configuradas,
// mesmo pausadas ou sem dados nos últimos 7 dias.
export async function fetchWindsorConnectedAccounts(
  datasource: string,
): Promise<WindsorConnectedAccountsResponse> {
  const status = getWindsorStatus();
  if (!status.configured) {
    return { accounts: [], error: status.reason };
  }

  const url = new URL(WINDSOR_DS_ACCOUNTS_ENDPOINT);
  url.searchParams.set("datasource", datasource);

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Api-Key": process.env.WINDSOR_API_KEY!,
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      const rawBody = await res.text().catch(() => "");
      const safeBody = rawBody
        .replace(/api_key=[^\s&"']*/gi, "api_key=***")
        .slice(0, 300);
      return {
        accounts: [],
        error: `Windsor ds-accounts respondeu com HTTP ${res.status}`,
        errorDetail: safeBody || undefined,
      };
    }

    const raw: unknown = await res.json();

    // Resposta confirmada: array direto de { account_id, account_name, datasource }
    if (!Array.isArray(raw)) {
      return {
        accounts: [],
        error: "Windsor ds-accounts retornou formato inesperado (esperado array direto).",
      };
    }

    const accounts: WindsorConnectedAccount[] = [];
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const obj = item as Record<string, unknown>;

      const rawId = obj.account_id;
      const rawName = obj.account_name;
      const rawDs = obj.datasource;

      const accountId =
        typeof rawId === "string" ? rawId.trim()
        : typeof rawId === "number" ? String(rawId)
        : null;
      const accountName = typeof rawName === "string" ? rawName.trim() : null;
      const ds = typeof rawDs === "string" ? rawDs.trim() : "";

      // Registros sem account_id ou account_name são ignorados silenciosamente
      if (!accountId || !accountName) continue;
      accounts.push({ accountId, accountName, datasource: ds });
    }

    return { accounts };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return { accounts: [], error: `Falha na conexão com Windsor ds-accounts: ${msg}` };
  }
}

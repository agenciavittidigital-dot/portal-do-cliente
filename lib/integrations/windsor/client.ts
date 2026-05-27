import "server-only";
import type { WindsorApiResponse, WindsorStatus } from "./types";

// Conector unificado da Windsor AI
const WINDSOR_ALL_ENDPOINT = "https://connectors.windsor.ai/all";

// Campos mínimos para o painel de preview
const WINDSOR_PREVIEW_FIELDS = [
  "date",
  "datasource",
  "account_name",
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

async function fetchWindsor(fields: string): Promise<WindsorApiResponse> {
  const status = getWindsorStatus();
  if (!status.configured) {
    return { error: status.reason };
  }

  const url = new URL(WINDSOR_ALL_ENDPOINT);
  url.searchParams.set("api_key", process.env.WINDSOR_API_KEY!);
  url.searchParams.set("fields", fields);
  url.searchParams.set("date_preset", "last_7d");

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

// Sync: conjunto completo de campos confirmados pela Sprint 6E-A
export async function fetchWindsorSyncData(): Promise<WindsorApiResponse> {
  return fetchWindsor(WINDSOR_SYNC_FIELDS.join(","));
}

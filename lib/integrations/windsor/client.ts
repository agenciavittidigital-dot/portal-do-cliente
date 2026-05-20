import "server-only";
import type { WindsorApiResponse, WindsorStatus } from "./types";

// TODO Sprint 6B: confirmar endpoint exato e parâmetros de paginação/filtro da Windsor
// antes de ativar chamadas reais em produção.
const WINDSOR_META_ENDPOINT = "https://connectors.windsor.ai/meta";

// Campos solicitados à Windsor — espelho das colunas de performance_daily
const WINDSOR_FIELDS = [
  "date",
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
  "ctr",
  "cpc",
  "cpm",
  "messages_started",
  "leads",
  "purchases",
  "purchase_value",
  "roas",
  "engagements",
  "video_views_25",
  "video_views_75",
  "frequency",
].join(",");

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

// Busca dados brutos da Windsor AI para o intervalo de datas fornecido.
// ATENÇÃO: Esta função faz chamada HTTP real à Windsor.
// Chamar apenas de forma manual/controlada em Sprint 6B após confirmação do endpoint.
export async function fetchWindsorRawData(
  dateStart: string,
  dateEnd: string
): Promise<WindsorApiResponse> {
  const status = getWindsorStatus();
  if (!status.configured) {
    return { error: status.reason };
  }

  const url = new URL(WINDSOR_META_ENDPOINT);
  url.searchParams.set("api_key", process.env.WINDSOR_API_KEY!);
  url.searchParams.set("fields", WINDSOR_FIELDS);
  url.searchParams.set("date_from", dateStart);
  url.searchParams.set("date_to", dateEnd);

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return { error: `Windsor respondeu com HTTP ${res.status}` };
    }

    return res.json() as Promise<WindsorApiResponse>;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return { error: `Falha na conexão com Windsor: ${msg}` };
  }
}

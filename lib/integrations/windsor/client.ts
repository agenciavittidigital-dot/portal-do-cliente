import "server-only";
import type { WindsorApiResponse, WindsorStatus } from "./types";

// Conector unificado da Windsor AI
const WINDSOR_ALL_ENDPOINT = "https://connectors.windsor.ai/all";

// Campos mínimos confirmados pelo painel Windsor — Sprint 6C expandirá para o conjunto completo
const WINDSOR_PREVIEW_FIELDS = [
  "date",
  "datasource",
  "account_name",
  "source",
  "campaign",
  "clicks",
  "spend",
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

// Busca dados brutos da Windsor AI.
// TODO Sprint 6C: adicionar params dateStart e dateEnd e substituir date_preset
// por date_from/date_to para respeitar o período selecionado pelo usuário.
export async function fetchWindsorRawData(): Promise<WindsorApiResponse> {
  const status = getWindsorStatus();
  if (!status.configured) {
    return { error: status.reason };
  }

  const url = new URL(WINDSOR_ALL_ENDPOINT);
  url.searchParams.set("api_key", process.env.WINDSOR_API_KEY!);
  url.searchParams.set("fields", WINDSOR_PREVIEW_FIELDS);
  // TODO Sprint 6C: usar date_from=_dateStart&date_to=_dateEnd
  url.searchParams.set("date_preset", "last_7d");

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      // Lê o body para diagnóstico — sanitiza possível vazamento de chave
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

import "server-only";
import type {
  MetaInsightRaw,
  MetaInsightsResponse,
  MetaAuthStatus,
  MetaFetchResult,
  MetaAccountInfo,
  MetaAccountDetails,
  MetaValidateResult,
  MetaClientConfig,
} from "./types";

// ── Configuração ──────────────────────────────────────────────────────────────

const DEFAULT_GRAPH_VERSION =
  process.env.META_GRAPH_API_VERSION?.trim() ?? "v21.0";

const MAX_PAGES = 50;
const FETCH_TIMEOUT_MS = 30_000;

// Status de conta (https://developers.facebook.com/docs/marketing-api/reference/ad-account)
const ACCOUNT_STATUS: Record<number, string> = {
  1: "Ativa",
  2: "Desativada",
  3: "Pendente de pagamento",
  7: "Em revisão de risco",
  8: "Pendente de liquidação",
  9: "Em período de carência",
  100: "Pendente de fechamento",
  101: "Encerrada",
};

// ── Helpers internos ──────────────────────────────────────────────────────────

function safeUrl(url: string): string {
  return url.replace(/access_token=[^&]+/gi, "access_token=***");
}

function normalizeAccountId(raw: string): string {
  return raw.trim().replace(/^act_/i, "");
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      signal: controller.signal,
      next: { revalidate: 0 },
    });
  } finally {
    clearTimeout(timer);
  }
}

// ── Core paginado — recebe token explicitamente ───────────────────────────────

async function fetchInsightsPaginatedCore(
  accessToken: string,
  accountId: string,
  params: Record<string, string>,
  graphVersion: string
): Promise<MetaFetchResult> {
  const baseUrl = `https://graph.facebook.com/${graphVersion}`;
  const normalId = normalizeAccountId(accountId);

  const records: MetaInsightRaw[] = [];
  let afterCursor: string | undefined = undefined;
  let pageCount = 0;

  while (pageCount < MAX_PAGES) {
    const url = new URL(`${baseUrl}/act_${normalId}/insights`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    if (afterCursor) url.searchParams.set("after", afterCursor);
    url.searchParams.set("access_token", accessToken);

    let res: Response;
    try {
      res = await fetchWithTimeout(url.toString(), FETCH_TIMEOUT_MS);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro de rede";
      return {
        records,
        pages: pageCount,
        error: `Falha na conexão com Graph API Meta (página ${pageCount + 1}): ${msg}`,
      };
    }

    let body: unknown;
    try {
      body = await res.json();
    } catch {
      return {
        records,
        pages: pageCount,
        error: `Graph API retornou resposta não-JSON (HTTP ${res.status}) — ${safeUrl(url.toString()).slice(0, 120)}`,
      };
    }

    const bodyObj = body as Record<string, unknown>;

    if (!res.ok || bodyObj.error) {
      const apiErr = bodyObj.error as Record<string, unknown> | undefined;
      const msg = String(apiErr?.message ?? `HTTP ${res.status}`);
      const code = apiErr?.code ?? res.status;
      return {
        records,
        pages: pageCount,
        error: `Graph API Meta erro ${code}: ${msg}`,
      };
    }

    const page = body as MetaInsightsResponse;
    if (Array.isArray(page.data)) records.push(...page.data);
    pageCount++;

    const nextCursor = page.paging?.cursors?.after;
    const hasNextPage = Boolean(page.paging?.next);
    if (!hasNextPage || !nextCursor) break;
    afterCursor = nextCursor;
  }

  if (pageCount >= MAX_PAGES) {
    console.warn(
      `[meta/client] Limite de segurança: ${MAX_PAGES} páginas para act_${normalId}.`
    );
  }

  return { records, pages: pageCount };
}

// ── Core validação de conta ───────────────────────────────────────────────────

async function validateAccountCore(
  accessToken: string,
  accountId: string,
  graphVersion: string
): Promise<MetaValidateResult> {
  const baseUrl = `https://graph.facebook.com/${graphVersion}`;
  const normalId = normalizeAccountId(accountId);
  const url = new URL(`${baseUrl}/act_${normalId}`);
  url.searchParams.set("fields", "id,name,account_status");
  url.searchParams.set("access_token", accessToken);

  let res: Response;
  try {
    res = await fetchWithTimeout(url.toString(), FETCH_TIMEOUT_MS);
  } catch (err) {
    return {
      ok: false,
      errorCode: null,
      errorSubcode: null,
      message: err instanceof Error ? err.message : "Falha de rede",
    };
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return {
      ok: false,
      errorCode: null,
      errorSubcode: null,
      message: `Resposta não-JSON (HTTP ${res.status})`,
    };
  }

  const bodyObj = body as Record<string, unknown>;

  if (!res.ok || bodyObj.error) {
    const apiErr = bodyObj.error as Record<string, unknown> | undefined;
    return {
      ok: false,
      errorCode: typeof apiErr?.code === "number" ? apiErr.code : null,
      errorSubcode:
        typeof apiErr?.error_subcode === "number" ? apiErr.error_subcode : null,
      message: String(apiErr?.message ?? `HTTP ${res.status}`),
    };
  }

  const statusCode =
    typeof bodyObj.account_status === "number" ? bodyObj.account_status : null;

  const account: MetaAccountInfo = {
    account_id: normalId,
    account_name: String(bodyObj.name ?? ""),
    account_status: statusCode,
    account_status_label:
      statusCode !== null
        ? (ACCOUNT_STATUS[statusCode] ?? `Status ${statusCode}`)
        : "Desconhecido",
  };

  return { ok: true, account };
}

// ── Core detalhes completos da conta ─────────────────────────────────────────

async function fetchAccountDetailsCore(
  accessToken: string,
  accountId: string,
  graphVersion: string
): Promise<MetaAccountDetails | null> {
  const baseUrl = `https://graph.facebook.com/${graphVersion}`;
  const normalId = normalizeAccountId(accountId);
  const url = new URL(`${baseUrl}/act_${normalId}`);
  url.searchParams.set(
    "fields",
    "id,name,account_status,currency,timezone_name,timezone_offset_hours_utc"
  );
  url.searchParams.set("access_token", accessToken);

  let res: Response;
  try {
    res = await fetchWithTimeout(url.toString(), FETCH_TIMEOUT_MS);
  } catch {
    return null;
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return null;
  }

  const bodyObj = body as Record<string, unknown>;
  if (!res.ok || bodyObj.error) return null;

  const statusCode =
    typeof bodyObj.account_status === "number" ? bodyObj.account_status : null;

  return {
    account_id: normalId,
    account_name: String(bodyObj.name ?? ""),
    account_status: statusCode,
    account_status_label:
      statusCode !== null
        ? (ACCOUNT_STATUS[statusCode] ?? `Status ${statusCode}`)
        : "Desconhecido",
    currency: bodyObj.currency ? String(bodyObj.currency) : null,
    timezone_name: bodyObj.timezone_name ? String(bodyObj.timezone_name) : null,
    timezone_offset_hours_utc:
      typeof bodyObj.timezone_offset_hours_utc === "number"
        ? bodyObj.timezone_offset_hours_utc
        : null,
  };
}

// ── Factory — uso por integração/cliente ──────────────────────────────────────
//
// Uso preferencial no código de produção:
//   const client = createMetaClient({ accessToken: decryptedToken });
//   const result = await client.fetchInsightsPaginated(accountId, params);

export function createMetaClient(config: MetaClientConfig) {
  const graphVersion = config.graphVersion ?? DEFAULT_GRAPH_VERSION;

  return {
    async fetchInsightsPaginated(
      accountId: string,
      params: Record<string, string>
    ): Promise<MetaFetchResult> {
      return fetchInsightsPaginatedCore(
        config.accessToken,
        accountId,
        params,
        graphVersion
      );
    },

    async validateAccount(accountId: string): Promise<MetaValidateResult> {
      return validateAccountCore(config.accessToken, accountId, graphVersion);
    },

    async fetchAccountDetails(accountId: string): Promise<MetaAccountDetails | null> {
      return fetchAccountDetailsCore(config.accessToken, accountId, graphVersion);
    },
  };
}

// ── Env-based (legado) ────────────────────────────────────────────────────────
// Mantido para compatibilidade com o script de preflight e testes locais.
// Código de produção deve usar createMetaClient({ accessToken }) acima.

function getEnvToken(): string | null {
  return process.env.META_ACCESS_TOKEN?.trim() ?? null;
}

export function getMetaAuthStatus(): MetaAuthStatus {
  const token = getEnvToken();
  if (!token) {
    return {
      configured: false,
      reason:
        "META_ACCESS_TOKEN não configurada. " +
        "Para uso em produção, configure a integração em Admin → Integrações.",
    };
  }
  return { configured: true };
}

export async function fetchMetaInsightsPaginated(
  accountId: string,
  params: Record<string, string>
): Promise<MetaFetchResult> {
  const token = getEnvToken();
  if (!token) {
    return {
      records: [],
      pages: 0,
      error:
        "META_ACCESS_TOKEN ausente. Use createMetaClient({ accessToken }) para integrações por cliente.",
    };
  }
  return fetchInsightsPaginatedCore(
    token,
    accountId,
    params,
    DEFAULT_GRAPH_VERSION
  );
}

export function getMetaClientConfig(): {
  graphVersion: string;
  tokenConfigured: boolean;
  maxPages: number;
  timeoutMs: number;
} {
  return {
    graphVersion: DEFAULT_GRAPH_VERSION,
    tokenConfigured: Boolean(getEnvToken()),
    maxPages: MAX_PAGES,
    timeoutMs: FETCH_TIMEOUT_MS,
  };
}

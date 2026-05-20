import "server-only";
import { getWindsorStatus } from "./client";

// ── Constantes ────────────────────────────────────────────────────────────────

const WINDSOR_ALL_ENDPOINT = "https://connectors.windsor.ai/all";

// Campos de contexto sempre incluídos em cada requisição de teste
const BASE_FIELDS = ["date", "account_name", "campaign"];

// Grupos a testar — separados para isolar qual grupo causa erro
export const FIELD_GROUPS: ReadonlyArray<{ readonly name: string; readonly fields: string[] }> = [
  {
    name: "Grupo 1 — Alcance",
    fields: ["impressions", "reach", "frequency"],
  },
  {
    name: "Grupo 2 — Custo",
    fields: ["ctr", "cpc", "cpm"],
  },
  {
    name: "Grupo 3 — Conversão",
    fields: ["leads", "messages_started", "purchases", "purchase_value", "roas"],
  },
  {
    name: "Grupo 4 — Engajamento",
    fields: ["engagements", "video_views_25", "video_views_75"],
  },
];

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FieldGroupResult {
  groupName: string;
  fields: string[];
  status: "accepted" | "rejected";
  recordCount: number;
  // Valores de amostra do primeiro registro: field → valor retornado pela Windsor
  sampleValues: Record<string, unknown> | null;
  errorDetail?: string;
}

export interface FieldsTestResult {
  success: boolean;
  groups: FieldGroupResult[];
  fieldsAccepted: string[];
  fieldsRejected: string[];
  // Primeiro registro aceito com os valores brutos (para visualização)
  sampleRecord: Record<string, unknown> | null;
  testedAt: string;
  error?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sanitizeBody(raw: string): string {
  return raw
    .replace(/api_key=[^\s&"']*/gi, "api_key=***")
    .slice(0, 300);
}

// ── Teste de um grupo de campos ───────────────────────────────────────────────

async function testGroup(
  apiKey: string,
  groupName: string,
  fields: string[]
): Promise<FieldGroupResult> {
  const allFields = [...BASE_FIELDS, ...fields].join(",");
  const url = new URL(WINDSOR_ALL_ENDPOINT);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("fields", allFields);
  url.searchParams.set("date_preset", "last_7d");

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      const rawBody = await res.text().catch(() => "");
      const detail = rawBody ? sanitizeBody(rawBody) : undefined;
      return {
        groupName,
        fields,
        status: "rejected",
        recordCount: 0,
        sampleValues: null,
        errorDetail: `HTTP ${res.status}${detail ? ` — ${detail}` : ""}`,
      };
    }

    const json = (await res.json()) as { data?: Record<string, unknown>[] };
    const data = json.data ?? [];

    // Extrai valores do primeiro registro para cada campo testado
    let sampleValues: Record<string, unknown> | null = null;
    if (data.length > 0) {
      const first = data[0];
      sampleValues = {};
      for (const field of fields) {
        sampleValues[field] = field in first ? first[field] : null;
      }
    }

    return {
      groupName,
      fields,
      status: "accepted",
      recordCount: data.length,
      sampleValues,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return {
      groupName,
      fields,
      status: "rejected",
      recordCount: 0,
      sampleValues: null,
      errorDetail: `Falha na conexão: ${msg}`,
    };
  }
}

// ── Função principal ──────────────────────────────────────────────────────────

export async function testWindsorFields(): Promise<FieldsTestResult> {
  const testedAt = new Date().toISOString();
  const status = getWindsorStatus();

  if (!status.configured) {
    return {
      success: false,
      groups: [],
      fieldsAccepted: [],
      fieldsRejected: [],
      sampleRecord: null,
      testedAt,
      error: status.reason,
    };
  }

  const apiKey = process.env.WINDSOR_API_KEY!;
  const groups: FieldGroupResult[] = [];

  // Testa grupos sequencialmente para não sobrecarregar a Windsor
  for (const group of FIELD_GROUPS) {
    const result = await testGroup(apiKey, group.name, group.fields);
    groups.push(result);
  }

  const fieldsAccepted = groups
    .filter((g) => g.status === "accepted")
    .flatMap((g) => g.fields);

  const fieldsRejected = groups
    .filter((g) => g.status === "rejected")
    .flatMap((g) => g.fields);

  // Primeiro sampleValues de um grupo aceito com dados reais
  const firstWithData = groups.find(
    (g) => g.status === "accepted" && g.sampleValues !== null
  );
  const sampleRecord = firstWithData?.sampleValues ?? null;

  return {
    success: true,
    groups,
    fieldsAccepted,
    fieldsRejected,
    sampleRecord,
    testedAt,
  };
}

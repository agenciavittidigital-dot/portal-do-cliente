import "server-only";
import { getWindsorStatus } from "./client";

// ── Configuração ──────────────────────────────────────────────────────────────

const ENDPOINT = "https://connectors.windsor.ai/all";

const BASE_FIELDS = ["date", "datasource", "account_name", "campaign", "spend", "clicks"];

// Candidatos expandidos — organizados por categoria para melhor diagnóstico.
// Testamos em lotes para distinguir "campo rejeitado" de "campo aceito mas sem dados".
export const PROBE_CATEGORIES: Array<{ name: string; fields: string[] }> = [
  {
    name: "Leads / Forms",
    fields: [
      "leads",
      "lead",
      "meta_leads",
      "facebook_leads",
      "website_leads",
      "instant_form_leads",
      "leadgen_grouped",
      "onsite_conversion_lead_grouped",
      "offsite_conversion_fb_pixel_lead",
      "onsite_conversion_post_save",
    ],
  },
  {
    name: "Mensagens / Conversas",
    fields: [
      "messages_started",
      "messaging_conversations_started",
      "messaging_conversation_started",
      "messaging_conversations_started_7d",
      "onsite_conversion_messaging_conversation_started_7d",
      "onsite_conversion_messaging_conversation_started_30d",
      "messaging_new_connections_7d",
      "conversations",
      "whatsapp_api_conversations",
    ],
  },
  {
    name: "Compras / Vendas",
    fields: [
      "purchases",
      "purchase",
      "purchase_value",
      "website_purchases",
      "website_purchase_value",
      "offsite_conversion_fb_pixel_purchase",
      "offsite_conversion_fb_pixel_purchase_value",
      "omni_purchase",
      "omni_purchase_value",
    ],
  },
  {
    name: "ROAS / Resultados",
    fields: [
      "roas",
      "purchase_roas",
      "website_purchase_roas",
      "results",
      "cost_per_result",
      "conversions",
      "conversion_values",
    ],
  },
  {
    name: "Cliques / Visualizações",
    fields: [
      "outbound_clicks",
      "link_clicks",
      "landing_page_views",
      "website_ctr",
    ],
  },
  {
    name: "Arrays (API Facebook nativa)",
    fields: ["actions", "action_values"],
  },
];

// Lista plana de todos os candidatos, sem duplicatas
const ALL_PROBE_FIELDS = [
  ...new Set(PROBE_CATEGORIES.flatMap((c) => c.fields)),
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function isDemoRecord(row: Record<string, unknown>): boolean {
  const acc = String(row.account_name ?? "").toLowerCase();
  const cam = String(row.campaign ?? row.campaign_name ?? "").toLowerCase();
  return acc.includes("demo") || cam.includes("demo");
}

function safeNum(val: unknown): number {
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

function sanitize(val: unknown, depth = 0): unknown {
  if (depth > 2) return "…";
  if (val == null) return null;
  if (typeof val === "number" || typeof val === "boolean") return val;
  if (typeof val === "string") return val.length > 120 ? val.slice(0, 120) + "…" : val;
  if (Array.isArray(val)) return val.slice(0, 6).map((v) => sanitize(v, depth + 1));
  if (typeof val === "object") {
    const out: Record<string, unknown> = {};
    let n = 0;
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (n++ >= 10) { out["…"] = "…"; break; }
      out[k] = sanitize(v, depth + 1);
    }
    return out;
  }
  return String(val).slice(0, 120);
}

function sanitizeBody(raw: string): string {
  return raw.replace(/api_key=[^\s&"']*/gi, "api_key=***").slice(0, 300);
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProbeFieldCoverage {
  field: string;
  category: string;
  status: "accepted" | "rejected";
  realNonZero: number;
  realNonNull: number;
  valueType: "numeric" | "array" | "object" | "string" | "empty" | null;
  sampleValue: unknown;
  sampleAccount: string | null;
  sampleCampaign: string | null;
  accountsWithValues: string[];  // contas com valor > 0 (até 5)
  errorDetail?: string;
}

export interface MetaRawProbeResult {
  success: boolean;
  testedAt: string;
  datePreset: string;
  endpoint: string;
  totalRecords: number;
  demoRecords: number;
  realRecords: number;
  realAccountNames: string[];
  fieldsWithRealValues: string[];
  fieldsWithRealData: string[];
  fieldCoverage: ProbeFieldCoverage[];
  categorySummary: Array<{
    name: string;
    accepted: number;
    rejected: number;
    withValues: number;
    withData: number;
  }>;
  // Amostra de registros reais com spend > 0
  sampleRealRecords: Array<Record<string, unknown>>;
  error?: string;
  errorDetail?: string;
}

// ── Fetch helper ──────────────────────────────────────────────────────────────

async function fetchFields(
  apiKey: string,
  probeFields: string[],
  datePreset: string
): Promise<{ ok: boolean; rows: Record<string, unknown>[]; errorDetail?: string }> {
  const allFields = [...BASE_FIELDS, ...probeFields].join(",");
  const url = new URL(ENDPOINT);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("fields", allFields);
  url.searchParams.set("date_preset", datePreset);

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, rows: [], errorDetail: `HTTP ${res.status} — ${sanitizeBody(body)}` };
    }
    const json = (await res.json()) as { data?: Record<string, unknown>[] };
    return { ok: true, rows: json.data ?? [] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return { ok: false, rows: [], errorDetail: `Falha na conexão: ${msg}` };
  }
}

// Analisa a cobertura de um campo nos registros reais
function buildCoverage(
  field: string,
  category: string,
  realRows: Record<string, unknown>[]
): Omit<ProbeFieldCoverage, "status" | "errorDetail"> {
  let realNonZero = 0;
  let realNonNull = 0;
  let valueType: ProbeFieldCoverage["valueType"] = "empty";
  let sampleValue: unknown = null;
  let sampleAccount: string | null = null;
  let sampleCampaign: string | null = null;
  const accWithValues = new Set<string>();

  for (const row of realRows) {
    const raw = row[field];
    if (raw == null) continue;
    realNonNull++;

    const acc = String(row.account_name ?? "").trim();
    const cam = String(row.campaign ?? row.campaign_name ?? "").trim();

    if (typeof raw === "number") {
      if (valueType === "empty") valueType = "numeric";
      if (raw > 0) {
        realNonZero++;
        accWithValues.add(acc);
        if (sampleValue === null) { sampleValue = raw; sampleAccount = acc; sampleCampaign = cam; }
      }
    } else if (typeof raw === "string") {
      const n = parseFloat(raw);
      if (!isNaN(n)) {
        if (valueType === "empty") valueType = "numeric";
        if (n > 0) {
          realNonZero++;
          accWithValues.add(acc);
          if (sampleValue === null) { sampleValue = n; sampleAccount = acc; sampleCampaign = cam; }
        }
      } else {
        if (valueType === "empty") valueType = "string";
        if (sampleValue === null) { sampleValue = sanitize(raw); sampleAccount = acc; }
      }
    } else if (Array.isArray(raw)) {
      valueType = "array";
      accWithValues.add(acc);
      if (sampleValue === null) { sampleValue = sanitize(raw); sampleAccount = acc; sampleCampaign = cam; }
    } else if (typeof raw === "object") {
      if (valueType === "empty") valueType = "object";
      if (sampleValue === null) { sampleValue = sanitize(raw); sampleAccount = acc; }
    }
  }

  return {
    field,
    category,
    realNonZero,
    realNonNull,
    valueType,
    sampleValue,
    sampleAccount,
    sampleCampaign,
    accountsWithValues: [...accWithValues].slice(0, 5),
  };
}

// ── Função principal ──────────────────────────────────────────────────────────

export async function probeMetaRawData(datePreset: string): Promise<MetaRawProbeResult> {
  const testedAt = new Date().toISOString();
  const base: MetaRawProbeResult = {
    success: false,
    testedAt,
    datePreset,
    endpoint: "/all",
    totalRecords: 0,
    demoRecords: 0,
    realRecords: 0,
    realAccountNames: [],
    fieldsWithRealValues: [],
    fieldsWithRealData: [],
    fieldCoverage: [],
    categorySummary: [],
    sampleRealRecords: [],
  };

  const windsorStatus = getWindsorStatus();
  if (!windsorStatus.configured) {
    return { ...base, error: windsorStatus.reason };
  }

  const apiKey = process.env.WINDSOR_API_KEY!;

  // ── Fase 1: tentar todos os candidatos em uma requisição ──────────────────
  const bulk = await fetchFields(apiKey, ALL_PROBE_FIELDS, datePreset);

  let allRows: Record<string, unknown>[] = [];
  const rejectedFields = new Set<string>();

  if (bulk.ok) {
    allRows = bulk.rows;
  } else {
    // ── Fase 2: falha no lote → testar categoria por categoria ───────────────
    for (const cat of PROBE_CATEGORIES) {
      const catResult = await fetchFields(apiKey, cat.fields, datePreset);
      if (catResult.ok) {
        // Mescla registros: mesmos campos base, campos da categoria adicionados
        if (allRows.length === 0) {
          allRows = catResult.rows;
        }
        // Copia valores dos campos desta categoria para os registros já existentes
        // (simplificação: usamos os valores desta categoria como-estão)
      } else {
        // Fase 3: rejeitar individualmente dentro da categoria
        for (const field of cat.fields) {
          const fieldResult = await fetchFields(apiKey, [field], datePreset);
          if (!fieldResult.ok) {
            rejectedFields.add(field);
          } else if (allRows.length === 0 && fieldResult.rows.length > 0) {
            allRows = fieldResult.rows;
          }
        }
      }
    }
  }

  base.totalRecords = allRows.length;

  // ── Separar demo de reais ─────────────────────────────────────────────────
  const realRows: Record<string, unknown>[] = [];
  let demoCount = 0;
  for (const row of allRows) {
    if (isDemoRecord(row)) demoCount++;
    else realRows.push(row);
  }
  base.demoRecords = demoCount;
  base.realRecords = realRows.length;

  const realAccNames = new Set<string>();
  for (const row of realRows) {
    const name = String(row.account_name ?? "").trim();
    if (name) realAccNames.add(name);
  }
  base.realAccountNames = [...realAccNames].slice(0, 20);

  if (realRows.length === 0) {
    return { ...base, success: true };
  }

  // ── Analisar cobertura por campo ──────────────────────────────────────────
  const coverage: ProbeFieldCoverage[] = [];

  for (const cat of PROBE_CATEGORIES) {
    for (const field of cat.fields) {
      if (rejectedFields.has(field)) {
        coverage.push({
          field,
          category: cat.name,
          status: "rejected",
          realNonZero: 0,
          realNonNull: 0,
          valueType: null,
          sampleValue: null,
          sampleAccount: null,
          sampleCampaign: null,
          accountsWithValues: [],
        });
      } else {
        coverage.push({
          status: "accepted",
          ...buildCoverage(field, cat.name, realRows),
        });
      }
    }
  }

  base.fieldCoverage = coverage;
  base.fieldsWithRealValues = coverage.filter((c) => c.realNonZero > 0).map((c) => c.field);
  base.fieldsWithRealData = coverage.filter((c) => c.realNonNull > 0).map((c) => c.field);

  // ── Resumo por categoria ──────────────────────────────────────────────────
  base.categorySummary = PROBE_CATEGORIES.map((cat) => {
    const catCoverage = coverage.filter((c) => c.category === cat.name);
    return {
      name: cat.name,
      accepted: catCoverage.filter((c) => c.status === "accepted").length,
      rejected: catCoverage.filter((c) => c.status === "rejected").length,
      withValues: catCoverage.filter((c) => c.realNonZero > 0).length,
      withData: catCoverage.filter((c) => c.realNonNull > 0 && c.realNonZero === 0).length,
    };
  });

  // ── Amostra de registros reais (spend > 0, campos não-nulos) ─────────────
  const SAMPLE_KEEP = new Set([
    "date", "account_name", "campaign", "datasource",
    "spend", "clicks", "impressions",
    ...ALL_PROBE_FIELDS,
  ]);

  base.sampleRealRecords = realRows
    .filter((r) => safeNum(r.spend) > 0)
    .slice(0, 5)
    .map((row) => {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) {
        if (!SAMPLE_KEEP.has(k)) continue;
        if (v == null || v === 0 || v === "0" || v === "") continue;
        out[k] = sanitize(v);
      }
      return out;
    });

  return { ...base, success: true };
}

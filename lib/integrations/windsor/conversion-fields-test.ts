import "server-only";
import { getWindsorStatus } from "./client";
import type {
  ConversionCategory,
  ConversionFieldStat,
  ConversionTestResult,
  DatePreset,
  WindsorEndpoint,
} from "./conversion-fields-types";

// ── Endpoints ──────────────────────────────────────────────────────────────────

const WINDSOR_ENDPOINT_URLS: Record<WindsorEndpoint, string> = {
  all: "https://connectors.windsor.ai/all",
  facebook: "https://connectors.windsor.ai/facebook",
};

const BASE_FIELDS = ["date", "account_name", "campaign", "spend", "clicks"];

// ── Candidatos ─────────────────────────────────────────────────────────────────

const CONVERSION_CANDIDATES: Record<ConversionCategory, string[]> = {
  // Grupo novo: campos de ação/conversão que podem retornar arrays
  actions: [
    "actions",
    "action_values",
    "conversions",
    "conversion_values",
    "results",
    "result_type",
    "cost_per_result",
    "website_ctr",
    "outbound_clicks",
    "landing_page_views",
    "link_clicks",
  ],
  messages: [
    "messages_started",
    "messaging_conversations_started",
    "messaging_conversation_started",
    "onsite_conversion_messaging_conversation_started_7d",
    "cost_per_messaging_conversation_started_7d",
  ],
  leads: [
    "leads",
    "lead",
    "meta_leads",
    "instant_form_leads",
    "onsite_conversion_lead_grouped",
    "offsite_conversion_fb_pixel_lead",
  ],
  purchases: [
    "purchases",
    "purchase",
    "purchase_value",
    "website_purchases",
    "website_purchase_value",
    "offsite_conversion_fb_pixel_purchase",
    "offsite_conversion_fb_pixel_purchase_value",
    "omni_purchase",
    "omni_purchase_value",
    "purchase_roas",
    "website_purchase_roas",
  ],
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function sanitizeBody(raw: string): string {
  return raw
    .replace(/api_key=[^\s&"']*/gi, "api_key=***")
    .slice(0, 300);
}

// Trunca recursivamente qualquer valor para serialização JSON segura
function sanitizeSampleValue(val: unknown, depth = 0): unknown {
  if (depth > 3) return "…";
  if (val == null) return null;
  if (typeof val === "number" || typeof val === "boolean") return val;
  if (typeof val === "string") {
    return val.length > 150 ? val.slice(0, 150) + "…" : val;
  }
  if (Array.isArray(val)) {
    return val.slice(0, 4).map((v) => sanitizeSampleValue(v, depth + 1));
  }
  if (typeof val === "object") {
    const result: Record<string, unknown> = {};
    let count = 0;
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (count++ >= 6) break;
      result[k] = sanitizeSampleValue(v, depth + 1);
    }
    return result;
  }
  return String(val).slice(0, 150);
}

async function fetchForFields(
  apiKey: string,
  endpointUrl: string,
  datePreset: DatePreset,
  candidates: string[]
): Promise<{ ok: boolean; data: Record<string, unknown>[]; errorDetail?: string }> {
  const allFields = [...BASE_FIELDS, ...candidates].join(",");
  const url = new URL(endpointUrl);
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
      const rawBody = await res.text().catch(() => "");
      const detail = rawBody ? sanitizeBody(rawBody) : undefined;
      return {
        ok: false,
        data: [],
        errorDetail: `HTTP ${res.status}${detail ? ` — ${detail}` : ""}`,
      };
    }

    const json = (await res.json()) as { data?: Record<string, unknown>[] };
    return { ok: true, data: json.data ?? [] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return { ok: false, data: [], errorDetail: `Falha na conexão: ${msg}` };
  }
}

function buildFieldStat(
  field: string,
  category: ConversionCategory,
  data: Record<string, unknown>[]
): ConversionFieldStat {
  let totalValue = 0;
  let nonZeroRows = 0;
  let nonNullRows = 0;
  let valueType: ConversionFieldStat["valueType"] = "empty";
  let sampleValue: unknown = undefined;
  let sampleCampaign: string | null = null;
  let sampleAccount: string | null = null;

  for (const row of data) {
    const raw = row[field];
    if (raw == null) continue;
    nonNullRows++;

    if (typeof raw === "number") {
      if (valueType === "empty") valueType = "numeric";
      if (raw > 0) {
        totalValue += raw;
        nonZeroRows++;
        if (sampleValue === undefined) sampleValue = raw;
        if (sampleCampaign === null && row.campaign) sampleCampaign = String(row.campaign);
        if (sampleAccount === null && row.account_name) sampleAccount = String(row.account_name);
      }
    } else if (typeof raw === "string") {
      const num = parseFloat(raw);
      if (!isNaN(num)) {
        if (valueType === "empty") valueType = "numeric";
        if (num > 0) {
          totalValue += num;
          nonZeroRows++;
          if (sampleValue === undefined) sampleValue = num;
          if (sampleCampaign === null && row.campaign) sampleCampaign = String(row.campaign);
          if (sampleAccount === null && row.account_name) sampleAccount = String(row.account_name);
        }
      } else {
        if (valueType === "empty") valueType = "string";
        if (sampleValue === undefined) sampleValue = raw.slice(0, 150);
      }
    } else if (Array.isArray(raw)) {
      valueType = "array";
      if (sampleValue === undefined) {
        sampleValue = sanitizeSampleValue(raw);
        if (sampleCampaign === null && row.campaign) sampleCampaign = String(row.campaign);
        if (sampleAccount === null && row.account_name) sampleAccount = String(row.account_name);
      }
    } else if (typeof raw === "object") {
      if (valueType === "empty") valueType = "object";
      if (sampleValue === undefined) {
        sampleValue = sanitizeSampleValue(raw);
        if (sampleCampaign === null && row.campaign) sampleCampaign = String(row.campaign);
        if (sampleAccount === null && row.account_name) sampleAccount = String(row.account_name);
      }
    }
  }

  return {
    field,
    category,
    status: "accepted",
    totalValue,
    nonZeroRows,
    nonNullRows,
    valueType,
    sampleValue: sampleValue !== undefined ? sanitizeSampleValue(sampleValue) : null,
    sampleCampaign,
    sampleAccount,
  };
}

function sanitizeRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((row) => {
    const safe: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      if (k === "api_key") continue;
      safe[k] = sanitizeSampleValue(v);
    }
    return safe;
  });
}

// ── Função principal — server-only ─────────────────────────────────────────────

export async function testWindsorConversionFields(options: {
  datePreset: DatePreset;
  endpoint: WindsorEndpoint;
}): Promise<ConversionTestResult> {
  const testedAt = new Date().toISOString();
  const { datePreset, endpoint } = options;
  const endpointUrl = WINDSOR_ENDPOINT_URLS[endpoint];
  const windsorStatus = getWindsorStatus();

  if (!windsorStatus.configured) {
    return {
      success: false,
      testedAt,
      endpoint,
      datePreset,
      totalFetched: 0,
      fieldsAccepted: [],
      fieldsRejected: [],
      fieldsWithValues: [],
      fieldsWithData: [],
      results: [],
      sampleRows: [],
      error: windsorStatus.reason,
    };
  }

  const apiKey = process.env.WINDSOR_API_KEY!;
  const results: ConversionFieldStat[] = [];
  const collectedSampleRows: Record<string, unknown>[] = [];
  let totalFetched = 0;

  const categories = Object.entries(CONVERSION_CANDIDATES) as [
    ConversionCategory,
    string[],
  ][];

  for (const [cat, candidates] of categories) {
    // Fase 1: todos os candidatos da categoria numa requisição
    const groupResult = await fetchForFields(apiKey, endpointUrl, datePreset, candidates);

    if (groupResult.ok) {
      totalFetched = Math.max(totalFetched, groupResult.data.length);
      for (const field of candidates) {
        results.push(buildFieldStat(field, cat, groupResult.data));
      }
      if (collectedSampleRows.length < 5 && groupResult.data.length > 0) {
        const take = Math.min(5 - collectedSampleRows.length, groupResult.data.length);
        collectedSampleRows.push(...groupResult.data.slice(0, take));
      }
    } else {
      // Fase 2: grupo rejeitado → testa cada campo individualmente
      for (const field of candidates) {
        const single = await fetchForFields(apiKey, endpointUrl, datePreset, [field]);
        if (single.ok) {
          totalFetched = Math.max(totalFetched, single.data.length);
          results.push(buildFieldStat(field, cat, single.data));
          if (collectedSampleRows.length < 5 && single.data.length > 0) {
            const take = Math.min(5 - collectedSampleRows.length, single.data.length);
            collectedSampleRows.push(...single.data.slice(0, take));
          }
        } else {
          results.push({
            field,
            category: cat,
            status: "rejected",
            totalValue: 0,
            nonZeroRows: 0,
            nonNullRows: 0,
            valueType: null,
            sampleValue: null,
            sampleCampaign: null,
            sampleAccount: null,
            errorDetail: single.errorDetail,
          });
        }
      }
    }
  }

  const fieldsAccepted = results
    .filter((r) => r.status === "accepted")
    .map((r) => r.field);

  const fieldsRejected = results
    .filter((r) => r.status === "rejected")
    .map((r) => r.field);

  const fieldsWithValues = results
    .filter((r) => r.status === "accepted" && r.nonZeroRows > 0)
    .map((r) => r.field);

  const fieldsWithData = results
    .filter((r) => r.status === "accepted" && r.nonNullRows > 0)
    .map((r) => r.field);

  return {
    success: true,
    testedAt,
    endpoint,
    datePreset,
    totalFetched,
    fieldsAccepted,
    fieldsRejected,
    fieldsWithValues,
    fieldsWithData,
    results,
    sampleRows: sanitizeRows(collectedSampleRows.slice(0, 5)),
  };
}

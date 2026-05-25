import "server-only";
import { getWindsorStatus } from "./client";

// ── Constantes ─────────────────────────────────────────────────────────────────

const WINDSOR_ALL_ENDPOINT = "https://connectors.windsor.ai/all";

// Campos a testar para Google Ads.
// "conversions" é o campo principal de conversão do Google Ads — pode não existir.
const GOOGLE_ADS_BASE_FIELDS = [
  "date",
  "datasource",
  "account_name",
  "source",
  "campaign",
  "clicks",
  "spend",
  "impressions",
  "ctr",
  "cpc",
  "cpm",
];

const GOOGLE_ADS_OPTIONAL_FIELDS = ["conversions"];

// Identifica registros Google Ads pelo campo datasource
function isGoogleAds(datasource: unknown): boolean {
  if (typeof datasource !== "string" || !datasource) return false;
  const lower = datasource.toLowerCase();
  return (
    lower.includes("google") ||
    lower.includes("adwords") ||
    lower === "gads" ||
    lower === "ga"
  );
}

function sanitizeBody(raw: string): string {
  return raw.replace(/api_key=[^\s&"']*/gi, "api_key=***").slice(0, 300);
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface GoogleAdsTestResult {
  success: boolean;
  error?: string;
  // Todos os valores únicos de datasource encontrados na Windsor
  allDatasources: string[];
  // Campos aceitos/rejeitados
  fieldsAccepted: string[];
  fieldsRejected: string[];
  // Total de registros Google Ads encontrados
  googleAdsRecords: number;
  // Contas únicas de Google Ads encontradas
  googleAdsAccounts: string[];
  // Amostra de 3 registros Google Ads
  sampleRecords: Record<string, unknown>[];
  testedAt: string;
}

// ── Fetch helper ───────────────────────────────────────────────────────────────

async function fetchWithFields(
  apiKey: string,
  fields: string[]
): Promise<{ ok: boolean; data?: Record<string, unknown>[]; errorDetail?: string }> {
  const url = new URL(WINDSOR_ALL_ENDPOINT);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("fields", fields.join(","));
  url.searchParams.set("date_preset", "last_7d");

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      const raw = await res.text().catch(() => "");
      return { ok: false, errorDetail: `HTTP ${res.status} — ${sanitizeBody(raw)}` };
    }

    const json = (await res.json()) as { data?: Record<string, unknown>[] };
    return { ok: true, data: json.data ?? [] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return { ok: false, errorDetail: `Falha na conexão: ${msg}` };
  }
}

// ── Função principal ───────────────────────────────────────────────────────────

export async function testGoogleAdsFields(): Promise<GoogleAdsTestResult> {
  const testedAt = new Date().toISOString();

  const status = getWindsorStatus();
  if (!status.configured) {
    return {
      success: false,
      error: status.reason,
      allDatasources: [],
      fieldsAccepted: [],
      fieldsRejected: [],
      googleAdsRecords: 0,
      googleAdsAccounts: [],
      sampleRecords: [],
      testedAt,
    };
  }

  const apiKey = process.env.WINDSOR_API_KEY!;

  // ── Passo 1: tenta campos base + conversions ──────────────────────────────
  const fullFields = [...GOOGLE_ADS_BASE_FIELDS, ...GOOGLE_ADS_OPTIONAL_FIELDS];
  let result = await fetchWithFields(apiKey, fullFields);

  const fieldsAccepted: string[] = [];
  const fieldsRejected: string[] = [];

  if (!result.ok) {
    // ── Passo 2: tenta sem "conversions" ─────────────────────────────────────
    result = await fetchWithFields(apiKey, GOOGLE_ADS_BASE_FIELDS);
    if (!result.ok) {
      return {
        success: false,
        error: `Windsor rejeitou os campos base: ${result.errorDetail ?? "erro desconhecido"}`,
        allDatasources: [],
        fieldsAccepted: [],
        fieldsRejected: [...GOOGLE_ADS_BASE_FIELDS, ...GOOGLE_ADS_OPTIONAL_FIELDS],
        googleAdsRecords: 0,
        googleAdsAccounts: [],
        sampleRecords: [],
        testedAt,
      };
    }
    fieldsAccepted.push(...GOOGLE_ADS_BASE_FIELDS);
    fieldsRejected.push(...GOOGLE_ADS_OPTIONAL_FIELDS);
  } else {
    fieldsAccepted.push(...GOOGLE_ADS_BASE_FIELDS, ...GOOGLE_ADS_OPTIONAL_FIELDS);
  }

  const allData = result.data ?? [];

  // ── Coleta datasources únicos ─────────────────────────────────────────────
  const datasourceSet = new Set<string>();
  for (const row of allData) {
    const ds = row.datasource;
    if (typeof ds === "string" && ds) datasourceSet.add(ds);
  }
  const allDatasources = [...datasourceSet].sort();

  // ── Filtra registros Google Ads ───────────────────────────────────────────
  const googleRows = allData.filter((row) => isGoogleAds(row.datasource));

  const accountSet = new Set<string>();
  for (const row of googleRows) {
    const name = typeof row.account_name === "string" ? row.account_name.trim() : "";
    if (name) accountSet.add(name);
  }

  // Sanitiza amostra: remove api_key se aparecer em algum campo
  const sampleRecords = googleRows.slice(0, 3).map((row) => {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      clean[k] = typeof v === "string" ? v.replace(/api_key=[^\s&"']*/gi, "api_key=***") : v;
    }
    return clean;
  });

  return {
    success: true,
    allDatasources,
    fieldsAccepted,
    fieldsRejected,
    googleAdsRecords: googleRows.length,
    googleAdsAccounts: [...accountSet].sort(),
    sampleRecords,
    testedAt,
  };
}

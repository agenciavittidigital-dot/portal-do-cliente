import "server-only";
import { getWindsorStatus } from "./client";

const WINDSOR_ALL_ENDPOINT = "https://connectors.windsor.ai/all";

// Campos solicitados para o teste de palavras-chave.
// datasource é adicionado para identificar a origem dos registros retornados.
const KEYWORD_TEST_FIELDS = [
  "keyword_text",
  "date",
  "campaign",
  "impressions",
  "clicks",
  "datasource",
];

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

export interface KeywordsTestSampleRow {
  keyword_text: string | null;
  date: string | null;
  campaign: string | null;
  impressions: number | null;
  clicks: number | null;
  datasource: string | null;
}

export interface KeywordsTestResult {
  success: boolean;
  error?: string;
  // Campos exatos enviados à Windsor (sem api_key)
  fieldsRequested: string[];
  // Total de linhas retornadas pela Windsor (todos os canais)
  totalRowsReturned: number;
  // Linhas identificadas como Google Ads
  googleAdsRows: number;
  // Quantidade de linhas Google Ads com keyword_text preenchido (não vazio)
  keywordTextFilled: number;
  // Quantidade de linhas Google Ads com keyword_text vazio/null
  keywordTextEmpty: number;
  // Taxa de preenchimento (0–100)
  keywordFillRate: number;
  // 5 linhas de amostra (Google Ads)
  sampleRows: KeywordsTestSampleRow[];
  // Campanhas únicas encontradas nas linhas com keyword_text
  campaignsWithKeywords: string[];
  // Se os dados parecem estar em nível de palavra-chave
  // (true quando há múltiplas linhas com keyword_texts distintos para a mesma campanha+data)
  appearsKeywordLevel: boolean;
  // Todos os datasources únicos encontrados na resposta
  allDatasources: string[];
  testedAt: string;
}

export async function testGoogleAdsKeywords(): Promise<KeywordsTestResult> {
  const testedAt = new Date().toISOString();

  const status = getWindsorStatus();
  if (!status.configured) {
    return {
      success: false,
      error: status.reason,
      fieldsRequested: KEYWORD_TEST_FIELDS,
      totalRowsReturned: 0,
      googleAdsRows: 0,
      keywordTextFilled: 0,
      keywordTextEmpty: 0,
      keywordFillRate: 0,
      sampleRows: [],
      campaignsWithKeywords: [],
      appearsKeywordLevel: false,
      allDatasources: [],
      testedAt,
    };
  }

  const apiKey = process.env.WINDSOR_API_KEY!;

  const url = new URL(WINDSOR_ALL_ENDPOINT);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("fields", KEYWORD_TEST_FIELDS.join(","));
  url.searchParams.set("date_preset", "last_7d");

  let allData: Record<string, unknown>[] = [];

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      const raw = await res.text().catch(() => "");
      const safe = raw.replace(/api_key=[^\s&"']*/gi, "api_key=***").slice(0, 400);
      return {
        success: false,
        error: `Windsor respondeu HTTP ${res.status}: ${safe}`,
        fieldsRequested: KEYWORD_TEST_FIELDS,
        totalRowsReturned: 0,
        googleAdsRows: 0,
        keywordTextFilled: 0,
        keywordTextEmpty: 0,
        keywordFillRate: 0,
        sampleRows: [],
        campaignsWithKeywords: [],
        appearsKeywordLevel: false,
        allDatasources: [],
        testedAt,
      };
    }

    const json = (await res.json()) as { data?: Record<string, unknown>[] };
    allData = json.data ?? [];
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return {
      success: false,
      error: `Falha na conexão com Windsor: ${msg}`,
      fieldsRequested: KEYWORD_TEST_FIELDS,
      totalRowsReturned: 0,
      googleAdsRows: 0,
      keywordTextFilled: 0,
      keywordTextEmpty: 0,
      keywordFillRate: 0,
      sampleRows: [],
      campaignsWithKeywords: [],
      appearsKeywordLevel: false,
      allDatasources: [],
      testedAt,
    };
  }

  // ── Datasources únicos ────────────────────────────────────────────────────
  const datasourceSet = new Set<string>();
  for (const row of allData) {
    const ds = row.datasource;
    if (typeof ds === "string" && ds) datasourceSet.add(ds);
  }
  const allDatasources = [...datasourceSet].sort();

  // ── Filtra Google Ads ─────────────────────────────────────────────────────
  const googleRows = allData.filter((row) => isGoogleAds(row.datasource));

  // ── Analisa keyword_text ──────────────────────────────────────────────────
  let filled = 0;
  let empty = 0;
  const campaignKwMap = new Map<string, Set<string>>();

  for (const row of googleRows) {
    const kw = row.keyword_text;
    const kwStr = typeof kw === "string" ? kw.trim() : "";

    if (kwStr) {
      filled++;
      const camp = typeof row.campaign === "string" ? row.campaign : "unknown";
      const dateStr = typeof row.date === "string" ? row.date : "unknown";
      const key = `${camp}__${dateStr}`;
      if (!campaignKwMap.has(key)) campaignKwMap.set(key, new Set());
      campaignKwMap.get(key)!.add(kwStr);
    } else {
      empty++;
    }
  }

  const fillRate =
    googleRows.length > 0 ? Math.round((filled / googleRows.length) * 100) : 0;

  // Aparenta nível de palavra-chave: há pelo menos uma campanha+data com 2+ keywords distintas
  const appearsKeywordLevel = [...campaignKwMap.values()].some((s) => s.size >= 2);

  // Campanhas únicas que têm keyword_text preenchido
  const campaignsWithKeywords = [
    ...new Set(
      googleRows
        .filter((r) => typeof r.keyword_text === "string" && (r.keyword_text as string).trim())
        .map((r) => (typeof r.campaign === "string" ? r.campaign : ""))
        .filter(Boolean)
    ),
  ].sort();

  // ── Amostra: 5 linhas com keyword_text preenchido (se houver); senão qualquer 5 ──
  const withKeyword = googleRows.filter(
    (r) => typeof r.keyword_text === "string" && (r.keyword_text as string).trim()
  );
  const sampleSource = withKeyword.length >= 5 ? withKeyword : googleRows;

  const sampleRows: KeywordsTestSampleRow[] = sampleSource.slice(0, 5).map((row) => ({
    keyword_text:
      typeof row.keyword_text === "string" ? (row.keyword_text as string).trim() || null : null,
    date: typeof row.date === "string" ? row.date : null,
    campaign: typeof row.campaign === "string" ? row.campaign : null,
    impressions:
      row.impressions !== undefined && row.impressions !== null
        ? Number(row.impressions)
        : null,
    clicks:
      row.clicks !== undefined && row.clicks !== null ? Number(row.clicks) : null,
    datasource: typeof row.datasource === "string" ? row.datasource : null,
  }));

  return {
    success: true,
    fieldsRequested: KEYWORD_TEST_FIELDS,
    totalRowsReturned: allData.length,
    googleAdsRows: googleRows.length,
    keywordTextFilled: filled,
    keywordTextEmpty: empty,
    keywordFillRate: fillRate,
    sampleRows,
    campaignsWithKeywords,
    appearsKeywordLevel,
    allDatasources,
    testedAt,
  };
}

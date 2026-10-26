// Meta Marketing API — tipos internos da integração direta
// Referência: https://developers.facebook.com/docs/marketing-api/reference/ads-insights

// ── Conversões ────────────────────────────────────────────────────────────────

// Item dentro de actions[], action_values[], purchase_roas[],
// video_p25_watched_actions[], video_p75_watched_actions[]
// A API Meta sempre retorna "value" como string — converter com Number()
export interface MetaAction {
  action_type: string;
  value: string;
}

// ── Paginação cursor-based ────────────────────────────────────────────────────

export interface MetaPagingCursors {
  before?: string;
  after?: string;
}

export interface MetaPaging {
  cursors?: MetaPagingCursors;
  next?: string;
  previous?: string;
}

// ── Erro da Graph API ─────────────────────────────────────────────────────────

export interface MetaApiError {
  message: string;
  type: string;
  code: number;
  error_subcode?: number;
  fbtrace_id?: string;
}

// ── Insight bruto retornado por /insights?level=ad ────────────────────────────
// Todos os campos são opcionais — Meta omite campos com valor zero ou sem dados.
// Campos numéricos chegam como string (ex: spend="123.45").
export interface MetaInsightRaw {
  date_start?: string;
  date_stop?: string;
  account_id?: string;
  account_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  frequency?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
  // purchase_roas retorna como array de MetaAction (action_type + value)
  purchase_roas?: MetaAction[];
  // Vídeo: percentuais de conclusão
  video_p25_watched_actions?: MetaAction[];
  video_p75_watched_actions?: MetaAction[];
  // Conversões e valores: arrays de { action_type, value }
  actions?: MetaAction[];
  action_values?: MetaAction[];
  // Campos adicionais que a API pode retornar
  [key: string]: unknown;
}

// ── Envelope de resposta paginada da Graph API ────────────────────────────────

export interface MetaInsightsResponse {
  data?: MetaInsightRaw[];
  paging?: MetaPaging;
  error?: MetaApiError;
}

// ── Registro normalizado ──────────────────────────────────────────────────────
// Campos numéricos convertidos; conversões extraídas de actions[].
// Pronto para uso interno — não grava diretamente em performance_daily ainda.
export interface MetaNormalizedRecord {
  date: string;
  account_id: string | null;
  account_name: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  adset_id: string | null;
  adset_name: string | null;
  ad_id: string | null;
  ad_name: string | null;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  frequency: number;
  ctr: number;
  cpc: number;
  cpm: number;
  leads: number;
  messages_started: number;
  purchases: number;
  purchase_value: number;
  add_to_cart: number;
  initiate_checkout: number;
  roas: number;
  video_views_25: number;
  video_views_75: number;
  landing_page_views: number;
}

// ── Status da configuração Meta no servidor ───────────────────────────────────

export type MetaAuthStatus =
  | { configured: true }
  | { configured: false; reason: string };

// ── Resultado de fetch paginado ───────────────────────────────────────────────

export interface MetaFetchResult {
  records: MetaInsightRaw[];
  pages: number;
  error?: string;
}

// ── Informações de conta retornadas pela Graph API ────────────────────────────

export interface MetaAccountInfo {
  account_id: string;
  account_name: string;
  account_status: number | null;
  account_status_label: string;
}

// ── Resultado de validação de conta ──────────────────────────────────────────

export type MetaValidateResult =
  | { ok: true; account: MetaAccountInfo }
  | { ok: false; errorCode: number | null; errorSubcode: number | null; message: string };

// ── Configuração do cliente Meta por integração ───────────────────────────────

export interface MetaClientConfig {
  accessToken: string;
  graphVersion?: string;
}

// ── Detalhes completos da conta (inclui currency/timezone) ────────────────────

export interface MetaAccountDetails {
  account_id: string;
  account_name: string;
  account_status: number | null;
  account_status_label: string;
  currency: string | null;
  timezone_name: string | null;
  timezone_offset_hours_utc: number | null;
}

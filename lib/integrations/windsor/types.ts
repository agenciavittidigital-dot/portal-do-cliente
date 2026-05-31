// Windsor AI — Tipos internos da integração
// Todos os campos são opcionais/nullable pois Windsor pode omitir campos com valor zero

// Registro bruto exatamente como chega da API Windsor
// Métricas numéricas podem vir como number ou string dependendo do conector
export interface WindsorRawRecord {
  date?: string | null;
  // Campos retornados pelo conector /all (preview mínimo)
  datasource?: string | null;
  source?: string | null;
  campaign?: string | null;       // Windsor usa 'campaign', não 'campaign_name'
  // Campos do conjunto completo (Sprint 6C)
  account_id?: string | null;
  account_name?: string | null;
  campaign_id?: string | null;
  campaign_name?: string | null;  // fallback — pode vir em outros conectores
  adset_id?: string | null;
  adset_name?: string | null;
  ad_id?: string | null;
  ad_name?: string | null;
  spend?: number | string | null;
  impressions?: number | string | null;
  reach?: number | string | null;
  clicks?: number | string | null;
  ctr?: number | string | null;
  cpc?: number | string | null;
  cpm?: number | string | null;
  messages_started?: number | string | null;
  leads?: number | string | null;
  purchases?: number | string | null;
  purchase_value?: number | string | null;
  roas?: number | string | null;
  engagements?: number | string | null;
  video_views_25?: number | string | null;
  video_views_75?: number | string | null;
  frequency?: number | string | null;
  // Campos de conversão achatados — nomes técnicos validados na Windsor
  actions_onsite_conversion_lead_grouped?: number | string | null;
  actions_onsite_conversion_messaging_conversation_started_7d?: number | string | null;
  actions_offsite_conversion_fb_pixel_purchase?: number | string | null;
  action_values_offsite_conversion_fb_pixel_purchase?: number | string | null;
  // Campos de conversão estruturados (fallback — Meta Ads arrays brutos)
  actions?: Array<Record<string, unknown>> | null;
  action_values?: Array<Record<string, unknown>> | null;
  // Criativo — thumbnail do anúncio/campanha
  thumbnail_url?: string | null;
  // Campos adicionais que Windsor pode retornar sem mapeamento prévio
  [key: string]: unknown;
}

// Registro normalizado — pronto para inserção em public.performance_daily
// Métricas numéricas têm fallback 0; campos de texto têm fallback null
export interface WindsorNormalizedRecord {
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
  ctr: number;
  cpc: number;
  cpm: number;
  messages_started: number;
  leads: number;
  purchases: number;
  purchase_value: number;
  roas: number;
  engagements: number;
  video_views_25: number;
  video_views_75: number;
  frequency: number;
  raw_data: Record<string, unknown>;
}

// Envelope de resposta da API Windsor (estrutura defensiva)
export interface WindsorApiResponse {
  data?: WindsorRawRecord[];
  error?: string;
  errorDetail?: string;   // trecho sanitizado do body HTTP em caso de erro
  [key: string]: unknown;
}

// Status da configuração Windsor no ambiente do servidor
export type WindsorStatus =
  | { configured: true; maskedKey: string }
  | { configured: false; reason: string };

// Resultado do preview — dados normalizados sem gravação em banco
export interface WindsorPreviewResult {
  status: WindsorStatus;
  recordCount: number;
  records: WindsorNormalizedRecord[];
  fetchedAt: string;
  error?: string;
}

// Resposta segura da rota /api/admin/windsor/preview
// Pode ser importada em Client Components — não contém dados sensíveis
export interface WindsorPreviewApiResponse {
  success: boolean;
  totalRecords: number;
  dateRange: { start: string; end: string };
  sampleRecords: Array<{
    date: string;
    campaign_name: string | null;
    spend: number;
    clicks: number;
  }>;
  totals: {
    spend: number;
    impressions: number;
    reach: number;
    clicks: number;
    messages_started: number;
    leads: number;
    purchases: number;
  };
  error?: string;
}

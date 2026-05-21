// Tipos e constantes públicas — diagnóstico de conversões Windsor.
// Este arquivo NÃO importa "server-only" — pode ser usado em Client Components.

export type DatePreset = "last_7d" | "last_14d" | "last_30d" | "last_90d";
export type WindsorEndpoint = "all" | "facebook";
export type ConversionCategory = "actions" | "messages" | "leads" | "purchases";

export const CATEGORY_LABELS: Record<ConversionCategory, string> = {
  actions: "Ações / Conversões",
  messages: "Mensagens / Conversas",
  leads: "Leads",
  purchases: "Compras / Vendas",
};

export interface ConversionFieldStat {
  field: string;
  category: ConversionCategory;
  status: "accepted" | "rejected";
  // Agregação numérica (só significativa quando valueType === "numeric")
  totalValue: number;
  nonZeroRows: number;
  // Presença geral — inclui objeto/array/string
  nonNullRows: number;
  valueType: "numeric" | "array" | "object" | "string" | "empty" | null;
  sampleValue: unknown; // sanitizado e truncado no servidor
  sampleCampaign: string | null;
  sampleAccount: string | null;
  errorDetail?: string;
}

export interface ConversionTestResult {
  success: boolean;
  testedAt: string;
  endpoint: WindsorEndpoint;
  datePreset: DatePreset;
  totalFetched: number;
  fieldsAccepted: string[];
  fieldsRejected: string[];
  fieldsWithValues: string[];  // numérico > 0
  fieldsWithData: string[];    // qualquer valor não-nulo (inclui array/objeto)
  results: ConversionFieldStat[];
  sampleRows: Array<Record<string, unknown>>;
  error?: string;
}

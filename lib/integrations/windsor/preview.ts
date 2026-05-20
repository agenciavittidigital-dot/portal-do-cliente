import "server-only";
import { fetchWindsorRawData, getWindsorStatus } from "./client";
import { normalizeWindsorRecords } from "./normalizers";
import type { WindsorPreviewResult } from "./types";

// Busca dados da Windsor, normaliza e retorna para inspeção.
// NÃO grava em performance_daily — seguro para uso manual e diagnóstico.
// Usar em rotas de API administrativas ou Server Actions (Sprint 6B).
export async function previewWindsorPerformance(
  dateStart: string,
  dateEnd: string
): Promise<WindsorPreviewResult> {
  const fetchedAt = new Date().toISOString();
  const status = getWindsorStatus();

  if (!status.configured) {
    console.error("[windsor/preview] Integração não configurada:", status.reason);
    return { status, recordCount: 0, records: [], fetchedAt, error: status.reason };
  }

  console.log("[windsor/preview] Chave Windsor presente. Buscando período:", dateStart, "→", dateEnd);

  const response = await fetchWindsorRawData(dateStart, dateEnd);

  if (response.error) {
    console.error("[windsor/preview] Erro na busca:", response.error);
    return { status, recordCount: 0, records: [], fetchedAt, error: response.error };
  }

  if (!response.data?.length) {
    console.log("[windsor/preview] Resposta vazia para o período solicitado.");
    return { status, recordCount: 0, records: [], fetchedAt };
  }

  const records = normalizeWindsorRecords(response.data);

  console.log("[windsor/preview] Registros normalizados:", records.length);

  // Loga exemplo sem expor dados sensíveis (sem spend absoluto, sem IDs de conta)
  if (records.length > 0) {
    const sample = records[0];
    console.log("[windsor/preview] Exemplo normalizado:", {
      date: sample.date,
      campaign_name: sample.campaign_name,
      impressions: sample.impressions,
      leads: sample.leads,
    });
  }

  return { status, recordCount: records.length, records, fetchedAt };
}

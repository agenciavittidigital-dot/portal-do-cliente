import "server-only";
import { fetchWindsorRawData, getWindsorStatus } from "./client";
import { normalizeWindsorRecords } from "./normalizers";
import type { WindsorPreviewResult } from "./types";

// Busca dados da Windsor, normaliza e retorna para inspeção.
// NÃO grava em performance_daily — seguro para uso manual e diagnóstico.
// Usar em rotas de API administrativas ou Server Actions (Sprint 6B).
export async function previewWindsorPerformance(
  _dateStart: string,
  _dateEnd: string
): Promise<WindsorPreviewResult> {
  const fetchedAt = new Date().toISOString();
  const status = getWindsorStatus();

  if (!status.configured) {
    console.error("[windsor/preview] Integração não configurada:", status.reason);
    return { status, recordCount: 0, records: [], fetchedAt, error: status.reason };
  }

  // TODO Sprint 6C: passar dateStart e dateEnd quando fetchWindsorRawData suportar date_from/date_to
  const response = await fetchWindsorRawData();

  if (response.error) {
    const detail = response.errorDetail ? ` — ${response.errorDetail}` : "";
    console.error("[windsor/preview] Erro na busca:", response.error + detail);
    const fullError = response.error + (response.errorDetail ? ` — ${response.errorDetail}` : "");
    return { status, recordCount: 0, records: [], fetchedAt, error: fullError };
  }

  if (!response.data?.length) {
    return { status, recordCount: 0, records: [], fetchedAt };
  }

  const records = normalizeWindsorRecords(response.data);

  return { status, recordCount: records.length, records, fetchedAt };
}

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

  // TODO Sprint 6C: passar dateStart e dateEnd quando fetchWindsorRawData suportar date_from/date_to
  const response = await fetchWindsorRawData();

  if (response.error) {
    // Inclui errorDetail no log para diagnóstico — nunca inclui a api_key
    const detail = response.errorDetail ? ` — ${response.errorDetail}` : "";
    console.error("[windsor/preview] Erro na busca:", response.error + detail);
    const fullError = response.error + (response.errorDetail ? ` — ${response.errorDetail}` : "");
    return { status, recordCount: 0, records: [], fetchedAt, error: fullError };
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
      clicks: sample.clicks,
      spend: sample.spend,
    });
  }

  return { status, recordCount: records.length, records, fetchedAt };
}

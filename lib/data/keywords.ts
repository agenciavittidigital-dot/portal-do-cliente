import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface GoogleAdsKeywordRow {
  keywordText: string;
  impressions: number;
  clicks: number;
  ctr: number | null;
}

export async function loadGoogleAdsKeywords(
  clientId: string,
  startDate: string,
  endDate: string
): Promise<GoogleAdsKeywordRow[]> {
  try {
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("performance_keywords")
      .select("keyword_text, impressions, clicks")
      .eq("client_id", clientId)
      .gte("date", startDate)
      .lte("date", endDate);

    if (error || !data?.length) return [];

    // Agrega por keyword_text somando impressões e cliques de múltiplas campanhas/dias
    const byKeyword = new Map<string, { impressions: number; clicks: number }>();

    for (const row of data) {
      const kw = (row.keyword_text ?? "").trim();
      if (!kw) continue;
      const imp = Number(row.impressions) || 0;
      const clk = Number(row.clicks) || 0;
      const existing = byKeyword.get(kw);
      if (existing) {
        existing.impressions += imp;
        existing.clicks += clk;
      } else {
        byKeyword.set(kw, { impressions: imp, clicks: clk });
      }
    }

    return [...byKeyword.entries()]
      .map(([kw, m]) => ({
        keywordText: kw,
        impressions: m.impressions,
        clicks: m.clicks,
        ctr: m.impressions > 0 ? (m.clicks / m.impressions) * 100 : null,
      }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 20);
  } catch (err) {
    console.error("[loadGoogleAdsKeywords] Erro:", err);
    return [];
  }
}

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadUserContext } from "@/lib/data/user-context";
import { previewWindsorPerformance } from "@/lib/integrations/windsor/preview";
import type { WindsorPreviewApiResponse } from "@/lib/integrations/windsor/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function err(message: string, status: number) {
  return NextResponse.json<WindsorPreviewApiResponse>(
    {
      success: false,
      totalRecords: 0,
      dateRange: { start: "", end: "" },
      sampleRecords: [],
      totals: { spend: 0, impressions: 0, reach: 0, clicks: 0, messages_started: 0, leads: 0, purchases: 0 },
      error: message,
    },
    { status }
  );
}

export async function GET(request: NextRequest) {
  // ── Autenticação ──────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return err("Não autenticado.", 401);

  // ── Autorização: somente vitti_admin ──────────────────────────
  const ctx = await loadUserContext(user.id);
  if (!ctx.isAdmin) return err("Acesso restrito a administradores Vitti.", 403);

  // ── Parâmetros ────────────────────────────────────────────────
  const { searchParams } = request.nextUrl;
  const startDate = searchParams.get("startDate") ?? "";
  const endDate = searchParams.get("endDate") ?? "";
  const clientId = searchParams.get("clientId") ?? null;

  if (!startDate || !endDate) {
    return err("startDate e endDate são obrigatórios.", 400);
  }
  if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
    return err("Datas devem estar no formato YYYY-MM-DD.", 400);
  }
  if (startDate > endDate) {
    return err("startDate não pode ser posterior a endDate.", 400);
  }

  // ── client_integrations (opcional, Sprint 6C usará para filtro por conta) ─
  if (clientId) {
    try {
      const admin = createAdminClient();
      await admin
        .from("client_integrations")
        .select("id, status")
        .eq("client_id", clientId)
        .maybeSingle();
    } catch {
      // Ignora falha — integração por cliente é opcional neste sprint
    }
  }

  // ── Preview Windsor (sem gravação em banco) ───────────────────
  const result = await previewWindsorPerformance(startDate, endDate);

  if (result.error || result.recordCount === 0) {
    const message = result.error ?? "Nenhum dado retornado pela Windsor para o período informado.";
    return NextResponse.json<WindsorPreviewApiResponse>(
      {
        success: false,
        totalRecords: 0,
        dateRange: { start: startDate, end: endDate },
        sampleRecords: [],
        totals: { spend: 0, impressions: 0, reach: 0, clicks: 0, messages_started: 0, leads: 0, purchases: 0 },
        error: message,
      },
      { status: result.error ? 502 : 200 }
    );
  }

  // ── Agrega totais (nunca retorna array completo) ──────────────
  const totals = result.records.reduce(
    (acc, r) => ({
      spend: acc.spend + r.spend,
      impressions: acc.impressions + r.impressions,
      reach: acc.reach + r.reach,
      clicks: acc.clicks + r.clicks,
      messages_started: acc.messages_started + r.messages_started,
      leads: acc.leads + r.leads,
      purchases: acc.purchases + r.purchases,
    }),
    { spend: 0, impressions: 0, reach: 0, clicks: 0, messages_started: 0, leads: 0, purchases: 0 }
  );

  // ── Amostra de 3 registros (sem account_id, sem IDs sensíveis) ─
  // Preview mínimo retorna: date, campaign, clicks, spend
  const sampleRecords = result.records.slice(0, 3).map((r) => ({
    date: r.date,
    campaign_name: r.campaign_name,
    spend: r.spend,
    clicks: r.clicks,
  }));

  return NextResponse.json<WindsorPreviewApiResponse>({
    success: true,
    totalRecords: result.recordCount,
    dateRange: { start: startDate, end: endDate },
    sampleRecords,
    totals,
  });
}

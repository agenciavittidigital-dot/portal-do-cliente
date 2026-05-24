import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveClientForUser } from "@/lib/data/invoices-client";
import { listPublishedReports } from "@/lib/data/reports-client";
import type { ClientReportRow } from "@/lib/data/reports-client";

export interface ClientReportListResponse {
  success: boolean;
  reports?: ClientReportRow[];
  error?: string;
  detail?: string;
}

// GET /api/reports — returns published reports for the logged-in user's client
export async function GET(): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json<ClientReportListResponse>(
      { success: false, error: "Não autenticado." },
      { status: 401 }
    );
  }

  try {
    const clientId = await resolveClientForUser(user.id);
    if (!clientId) {
      return NextResponse.json<ClientReportListResponse>({ success: true, reports: [] });
    }

    const reports = await listPublishedReports(clientId);
    return NextResponse.json<ClientReportListResponse>({ success: true, reports });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Erro desconhecido.";
    return NextResponse.json<ClientReportListResponse>(
      { success: false, error: "Erro ao carregar relatórios.", detail },
      { status: 500 }
    );
  }
}

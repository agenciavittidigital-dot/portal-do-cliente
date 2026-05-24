import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { updateReport } from "@/lib/data/reports-admin";
import type { AdminReportRow, ReportStatus } from "@/lib/data/reports-admin";

export interface ReportPatchResponse {
  success: boolean;
  report?: AdminReportRow;
  error?: string;
  detail?: string;
}

async function requireAdmin(): Promise<{ userId: string } | { error: Response }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error: NextResponse.json<ReportPatchResponse>(
        { success: false, error: "Não autenticado." },
        { status: 401 }
      ),
    };
  }
  const ctx = await loadUserContext(user.id);
  if (!ctx.isAdmin) {
    return {
      error: NextResponse.json<ReportPatchResponse>(
        { success: false, error: "Acesso restrito a administradores Vitti." },
        { status: 403 }
      ),
    };
  }
  return { userId: user.id };
}

const VALID_STATUSES: ReportStatus[] = ["draft", "published", "archived"];

// PATCH /api/admin/reports/[id] — metadata only, no file replacement
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  if (!id) {
    return NextResponse.json<ReportPatchResponse>(
      { success: false, error: "ID inválido." },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<ReportPatchResponse>(
      { success: false, error: "Body inválido." },
      { status: 400 }
    );
  }

  const b = body as Record<string, unknown>;
  const patch: Parameters<typeof updateReport>[1] = {};

  if (typeof b.title === "string" && b.title.trim()) patch.title = b.title.trim();
  if (typeof b.period === "string" && b.period.trim()) patch.period = b.period.trim();
  if (typeof b.status === "string" && VALID_STATUSES.includes(b.status as ReportStatus)) {
    patch.status = b.status as ReportStatus;
  }
  if ("description" in b) {
    patch.description =
      typeof b.description === "string" && b.description.trim()
        ? b.description.trim()
        : null;
  }
  if ("summary" in b) {
    patch.summary =
      typeof b.summary === "string" && b.summary.trim() ? b.summary.trim() : null;
  }

  try {
    const report = await updateReport(id, patch);
    return NextResponse.json<ReportPatchResponse>({ success: true, report });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Erro desconhecido.";
    return NextResponse.json<ReportPatchResponse>(
      { success: false, error: "Erro ao atualizar relatório.", detail },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { ensureDefaultDashboard } from "@/lib/data/clients-admin";

export interface EnsureDashboardResponse {
  success: boolean;
  dashboardId?: string;
  dashboardCreated?: boolean;
  blocksCreated?: number;
  blocksExisting?: number;
  metricsCreated?: number;
  metricsExisting?: number;
  totalBlocks?: number;
  totalMetrics?: number;
  message?: string;
  error?: string;
  detail?: string;
}

async function requireAdmin(): Promise<
  { userId: string } | { error: Response }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json<EnsureDashboardResponse>(
        { success: false, error: "Não autenticado." },
        { status: 401 }
      ),
    };
  }

  const ctx = await loadUserContext(user.id);
  if (!ctx.isAdmin) {
    return {
      error: NextResponse.json<EnsureDashboardResponse>(
        { success: false, error: "Acesso restrito a administradores Vitti." },
        { status: 403 }
      ),
    };
  }

  return { userId: user.id };
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;

  if (!id) {
    return NextResponse.json<EnsureDashboardResponse>(
      { success: false, error: "ID inválido." },
      { status: 400 }
    );
  }

  try {
    const result = await ensureDefaultDashboard(id);
    return NextResponse.json<EnsureDashboardResponse>({
      success: true,
      dashboardId: result.dashboardId,
      dashboardCreated: result.dashboardCreated,
      blocksCreated: result.blocksCreated,
      blocksExisting: result.blocksExisting,
      metricsCreated: result.metricsCreated,
      metricsExisting: result.metricsExisting,
      totalBlocks: result.totalBlocks,
      totalMetrics: result.totalMetrics,
      message: result.message,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Erro desconhecido.";
    console.error("[ensure-dashboard]", detail);
    return NextResponse.json<EnsureDashboardResponse>(
      {
        success: false,
        error: "Falha ao garantir dashboard padrão.",
        detail,
      },
      { status: 500 }
    );
  }
}

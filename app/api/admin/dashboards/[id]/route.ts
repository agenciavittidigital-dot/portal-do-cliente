import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { updateAdminDashboard } from "@/lib/data/dashboards-admin";

export interface DashboardPatchResponse {
  success: boolean;
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
      error: NextResponse.json<DashboardPatchResponse>(
        { success: false, error: "Não autenticado." },
        { status: 401 }
      ),
    };
  }
  const ctx = await loadUserContext(user.id);
  if (!ctx.isAdmin) {
    return {
      error: NextResponse.json<DashboardPatchResponse>(
        { success: false, error: "Acesso restrito a administradores Vitti." },
        { status: 403 }
      ),
    };
  }
  return { userId: user.id };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  if (!id) {
    return NextResponse.json<DashboardPatchResponse>(
      { success: false, error: "ID inválido." },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<DashboardPatchResponse>(
      { success: false, error: "Body inválido." },
      { status: 400 }
    );
  }

  const { status, settingsPatch } = body as Record<string, unknown>;

  const patch: Parameters<typeof updateAdminDashboard>[1] = {};

  if (status === "published" || status === "draft") {
    patch.status = status;
  }

  if (settingsPatch && typeof settingsPatch === "object" && !Array.isArray(settingsPatch)) {
    patch.settingsPatch = settingsPatch as Record<string, unknown>;
  }

  try {
    await updateAdminDashboard(id, patch);
    return NextResponse.json<DashboardPatchResponse>({ success: true });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Erro desconhecido.";
    return NextResponse.json<DashboardPatchResponse>(
      { success: false, error: "Erro ao atualizar dashboard.", detail },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { updateAdminDashboardBlockMetric } from "@/lib/data/dashboards-admin";

export interface MetricPatchResponse {
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
      error: NextResponse.json<MetricPatchResponse>(
        { success: false, error: "Não autenticado." },
        { status: 401 }
      ),
    };
  }
  const ctx = await loadUserContext(user.id);
  if (!ctx.isAdmin) {
    return {
      error: NextResponse.json<MetricPatchResponse>(
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
    return NextResponse.json<MetricPatchResponse>(
      { success: false, error: "ID inválido." },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<MetricPatchResponse>(
      { success: false, error: "Body inválido." },
      { status: 400 }
    );
  }

  const b = body as Record<string, unknown>;
  const patch: Parameters<typeof updateAdminDashboardBlockMetric>[1] = {};

  if (typeof b.visible === "boolean") patch.visible = b.visible;

  if ("display_name" in b) {
    patch.display_name =
      b.display_name && typeof b.display_name === "string"
        ? b.display_name.trim() || null
        : null;
  }

  if (typeof b.position === "number" && b.position >= 0) {
    patch.position = Math.round(b.position);
  }

  if ("show_variation" in b) {
    patch.show_variation =
      typeof b.show_variation === "boolean" ? b.show_variation : null;
  }

  if ("show_sparkline" in b) {
    patch.show_sparkline =
      typeof b.show_sparkline === "boolean" ? b.show_sparkline : null;
  }

  try {
    await updateAdminDashboardBlockMetric(id, patch);
    return NextResponse.json<MetricPatchResponse>({ success: true });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Erro desconhecido.";
    return NextResponse.json<MetricPatchResponse>(
      { success: false, error: "Erro ao atualizar métrica.", detail },
      { status: 500 }
    );
  }
}

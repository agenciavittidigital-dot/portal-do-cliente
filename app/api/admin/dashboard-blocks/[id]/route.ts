import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { updateAdminDashboardBlock } from "@/lib/data/dashboards-admin";

export interface BlockPatchResponse {
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
      error: NextResponse.json<BlockPatchResponse>(
        { success: false, error: "Não autenticado." },
        { status: 401 }
      ),
    };
  }
  const ctx = await loadUserContext(user.id);
  if (!ctx.isAdmin) {
    return {
      error: NextResponse.json<BlockPatchResponse>(
        { success: false, error: "Acesso restrito a administradores Vitti." },
        { status: 403 }
      ),
    };
  }
  return { userId: user.id };
}

const VALID_SIZES = ["small", "medium", "large", "full"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  if (!id) {
    return NextResponse.json<BlockPatchResponse>(
      { success: false, error: "ID inválido." },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<BlockPatchResponse>(
      { success: false, error: "Body inválido." },
      { status: 400 }
    );
  }

  const b = body as Record<string, unknown>;
  const patch: Parameters<typeof updateAdminDashboardBlock>[1] = {};

  if (typeof b.visible === "boolean") patch.visible = b.visible;

  if ("title" in b) {
    patch.title =
      b.title && typeof b.title === "string" ? b.title.trim() || null : null;
  }

  if ("description" in b) {
    patch.description =
      b.description && typeof b.description === "string"
        ? b.description.trim() || null
        : null;
  }

  if (typeof b.position === "number" && b.position >= 0) {
    patch.position = Math.round(b.position);
  }

  if ("size" in b) {
    const s = typeof b.size === "string" ? b.size : null;
    patch.size = s && VALID_SIZES.includes(s) ? s : null;
  }

  if (
    "settingsPatch" in b &&
    typeof b.settingsPatch === "object" &&
    b.settingsPatch !== null &&
    !Array.isArray(b.settingsPatch)
  ) {
    patch.settingsPatch = b.settingsPatch as Record<string, unknown>;
  }

  try {
    await updateAdminDashboardBlock(id, patch);
    return NextResponse.json<BlockPatchResponse>({ success: true });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Erro desconhecido.";
    return NextResponse.json<BlockPatchResponse>(
      { success: false, error: "Erro ao atualizar bloco.", detail },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { setUserPermissions } from "@/lib/data/users-admin";

export interface UserPermissionsPatchResponse {
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
      error: NextResponse.json<UserPermissionsPatchResponse>(
        { success: false, error: "Não autenticado." },
        { status: 401 }
      ),
    };
  }
  const ctx = await loadUserContext(user.id);
  if (!ctx.isAdmin) {
    return {
      error: NextResponse.json<UserPermissionsPatchResponse>(
        { success: false, error: "Acesso restrito a administradores Vitti." },
        { status: 403 }
      ),
    };
  }
  return { userId: user.id };
}

// PATCH /api/admin/users/[id]/permissions
// Body: { permissionIds: string[] }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  if (!id) {
    return NextResponse.json<UserPermissionsPatchResponse>(
      { success: false, error: "ID inválido." },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<UserPermissionsPatchResponse>(
      { success: false, error: "Body inválido." },
      { status: 400 }
    );
  }

  const b = body as Record<string, unknown>;

  if (!Array.isArray(b.permissionIds)) {
    return NextResponse.json<UserPermissionsPatchResponse>(
      { success: false, error: "permissionIds deve ser um array." },
      { status: 400 }
    );
  }

  const permissionIds = (b.permissionIds as unknown[])
    .filter((v) => typeof v === "string")
    .map((v) => String(v));

  try {
    await setUserPermissions(id, permissionIds);
    return NextResponse.json<UserPermissionsPatchResponse>({ success: true });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Erro desconhecido.";
    return NextResponse.json<UserPermissionsPatchResponse>(
      { success: false, error: "Erro ao atualizar permissões.", detail },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import {
  getAdminUserDetail,
  updateAdminUserProfile,
} from "@/lib/data/users-admin";
import type { AdminUserDetail } from "@/lib/data/users-admin";
import type { GlobalRole } from "@/types";

export interface UserDetailResponse {
  success: boolean;
  user?: AdminUserDetail;
  error?: string;
}

export interface UserPatchResponse {
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
      error: NextResponse.json<UserPatchResponse>(
        { success: false, error: "Não autenticado." },
        { status: 401 }
      ),
    };
  }
  const ctx = await loadUserContext(user.id);
  if (!ctx.isAdmin) {
    return {
      error: NextResponse.json<UserPatchResponse>(
        { success: false, error: "Acesso restrito a administradores Vitti." },
        { status: 403 }
      ),
    };
  }
  return { userId: user.id };
}

// GET /api/admin/users/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  if (!id) {
    return NextResponse.json<UserDetailResponse>(
      { success: false, error: "ID inválido." },
      { status: 400 }
    );
  }

  const user = await getAdminUserDetail(id);
  if (!user) {
    return NextResponse.json<UserDetailResponse>(
      { success: false, error: "Usuário não encontrado." },
      { status: 404 }
    );
  }

  return NextResponse.json<UserDetailResponse>({ success: true, user });
}

// PATCH /api/admin/users/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  if (!id) {
    return NextResponse.json<UserPatchResponse>(
      { success: false, error: "ID inválido." },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<UserPatchResponse>(
      { success: false, error: "Body inválido." },
      { status: 400 }
    );
  }

  const b = body as Record<string, unknown>;
  const patch: Parameters<typeof updateAdminUserProfile>[1] = {};

  if ("name" in b) {
    patch.name =
      b.name && typeof b.name === "string" ? b.name.trim() || null : null;
  }

  if (typeof b.status === "string" && ["active", "inactive"].includes(b.status)) {
    patch.status = b.status as "active" | "inactive";
  }

  if (
    typeof b.globalRole === "string" &&
    ["vitti_admin", "client_user"].includes(b.globalRole)
  ) {
    patch.globalRole = b.globalRole as GlobalRole;
  }

  try {
    await updateAdminUserProfile(id, patch);
    return NextResponse.json<UserPatchResponse>({ success: true });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Erro desconhecido.";
    return NextResponse.json<UserPatchResponse>(
      { success: false, error: "Erro ao atualizar perfil.", detail },
      { status: 500 }
    );
  }
}

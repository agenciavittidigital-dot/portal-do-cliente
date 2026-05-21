import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { setUserClient } from "@/lib/data/users-admin";

export interface UserClientPatchResponse {
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
      error: NextResponse.json<UserClientPatchResponse>(
        { success: false, error: "Não autenticado." },
        { status: 401 }
      ),
    };
  }
  const ctx = await loadUserContext(user.id);
  if (!ctx.isAdmin) {
    return {
      error: NextResponse.json<UserClientPatchResponse>(
        { success: false, error: "Acesso restrito a administradores Vitti." },
        { status: 403 }
      ),
    };
  }
  return { userId: user.id };
}

// PATCH /api/admin/users/[id]/client
// Body: { clientId: string | null }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  if (!id) {
    return NextResponse.json<UserClientPatchResponse>(
      { success: false, error: "ID inválido." },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<UserClientPatchResponse>(
      { success: false, error: "Body inválido." },
      { status: 400 }
    );
  }

  const b = body as Record<string, unknown>;

  if (!("clientId" in b)) {
    return NextResponse.json<UserClientPatchResponse>(
      { success: false, error: "Campo clientId é obrigatório (pode ser null)." },
      { status: 400 }
    );
  }

  const clientId =
    b.clientId && typeof b.clientId === "string" ? b.clientId : null;

  const role =
    b.role && typeof b.role === "string" ? b.role : undefined;

  try {
    await setUserClient(id, clientId, role);
    return NextResponse.json<UserClientPatchResponse>({ success: true });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Erro desconhecido.";
    return NextResponse.json<UserClientPatchResponse>(
      { success: false, error: "Erro ao atualizar vínculo com cliente.", detail },
      { status: 500 }
    );
  }
}

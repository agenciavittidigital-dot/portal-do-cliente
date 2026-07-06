import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, error: "Não autenticado.", status: 401 };
  const ctx = await loadUserContext(user.id);
  if (!ctx.isAdmin) return { user, error: "Acesso restrito.", status: 403 };
  return { user, error: null, status: 200 };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error)
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status }
    );

  const { id } = await params;
  if (!id)
    return NextResponse.json(
      { success: false, error: "ID inválido." },
      { status: 400 }
    );

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Body inválido." },
      { status: 400 }
    );
  }

  const b = body as Record<string, unknown>;
  const patch: Record<string, unknown> = {};

  if (b.client_id !== undefined)     patch.client_id = b.client_id;
  if (b.category_id !== undefined)   patch.category_id = b.category_id;
  if (b.status_id !== undefined)     patch.status_id = b.status_id;
  if (b.responsible_id !== undefined) patch.responsible_id = b.responsible_id;
  if (b.title !== undefined)         patch.title = String(b.title).trim();
  if (b.description !== undefined)   patch.description = b.description || null;
  if (b.caption !== undefined)       patch.caption = b.caption || null;
  if (b.scheduled_at !== undefined)  patch.scheduled_at = b.scheduled_at || null;
  if (b.delivery_at !== undefined)   patch.delivery_at = b.delivery_at || null;

  const admin = createAdminClient();
  const { error } = await admin
    .from("editorial_contents")
    .update(patch)
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { success: false, error: "Erro ao atualizar conteúdo.", detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error)
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status }
    );

  const { id } = await params;
  if (!id)
    return NextResponse.json(
      { success: false, error: "ID inválido." },
      { status: 400 }
    );

  const admin = createAdminClient();
  const { error } = await admin
    .from("editorial_contents")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { success: false, error: "Erro ao excluir conteúdo.", detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}

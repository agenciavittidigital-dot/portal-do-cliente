import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { listEditorialContents } from "@/lib/data/editorial";

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

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error)
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status }
    );

  const clientId = req.nextUrl.searchParams.get("clientId") ?? undefined;
  const contents = await listEditorialContents(clientId ? { clientId } : undefined);
  return NextResponse.json({ success: true, contents });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error)
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status }
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

  if (!b.title || typeof b.title !== "string" || !b.title.trim()) {
    return NextResponse.json(
      { success: false, error: "Título é obrigatório." },
      { status: 400 }
    );
  }
  if (!b.client_id || typeof b.client_id !== "string") {
    return NextResponse.json(
      { success: false, error: "Cliente é obrigatório." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("auth_user_id", auth.user!.id)
    .maybeSingle();

  const { data, error } = await admin
    .from("editorial_contents")
    .insert({
      client_id: b.client_id,
      category_id: b.category_id ?? null,
      status_id: b.status_id ?? null,
      responsible_id: b.responsible_id ?? null,
      title: String(b.title).trim(),
      description: b.description ? String(b.description).trim() : null,
      caption: b.caption ? String(b.caption).trim() : null,
      scheduled_at: b.scheduled_at ?? null,
      delivery_at: b.delivery_at ?? null,
      created_by: profile?.id ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { success: false, error: "Erro ao criar conteúdo.", detail: error?.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, id: String(data.id) });
}

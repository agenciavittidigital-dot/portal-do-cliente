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

function authorName(profile: { name?: string | null; email?: string | null } | null): string {
  if (!profile) return "Admin Vitti";
  return String(profile.name || profile.email || "Admin Vitti");
}

// GET /api/admin/editorial/[id]/comments
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const auth = await requireAdmin();
  if (auth.error)
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status }
    );

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("editorial_comments")
    .select("id, message, created_at, author_id")
    .eq("content_id", id)
    .order("created_at", { ascending: true });

  if (error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );

  // Resolve author names in a single batch query
  const authorIds = [...new Set((data ?? []).map((r) => r.author_id).filter(Boolean))];
  const profilesMap = new Map<string, { name: string | null; email: string | null }>();

  if (authorIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, name, email")
      .in("id", authorIds);
    for (const p of profiles ?? []) {
      profilesMap.set(String(p.id), { name: p.name ?? null, email: p.email ?? null });
    }
  }

  const comments = (data ?? []).map((row) => ({
    id: String(row.id),
    message: String(row.message),
    createdAt: String(row.created_at),
    authorName: authorName(
      row.author_id ? (profilesMap.get(String(row.author_id)) ?? null) : null
    ),
  }));

  return NextResponse.json({ success: true, comments });
}

// POST /api/admin/editorial/[id]/comments
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

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
  const message = typeof b.message === "string" ? b.message.trim() : "";

  if (!message)
    return NextResponse.json(
      { success: false, error: "Mensagem não pode ser vazia." },
      { status: 400 }
    );

  const admin = createAdminClient();

  // Resolve current user's profile
  const { data: profile } = await admin
    .from("profiles")
    .select("id, name, email")
    .eq("auth_user_id", auth.user!.id)
    .maybeSingle();

  const insertPayload = {
    content_id: id,
    author_id: profile?.id ?? null,
    message,
  };

  const { data: insertedRaw, error: insertError } = await admin
    .from("editorial_comments")
    .insert(insertPayload)
    .select("id, message, created_at, author_id")
    .single();

  if (insertError || !insertedRaw)
    return NextResponse.json(
      {
        success: false,
        error: insertError?.message ?? "Erro ao salvar comentário.",
        code: insertError?.code,
      },
      { status: 500 }
    );

  const comment = {
    id: String(insertedRaw.id),
    message: String(insertedRaw.message),
    createdAt: String(insertedRaw.created_at),
    authorName: authorName(
      profile ? { name: profile.name, email: profile.email } : null
    ),
  };

  return NextResponse.json({ success: true, comment });
}

// DELETE /api/admin/editorial/[id]/comments?commentId=xxx
export async function DELETE(
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
  const commentId = req.nextUrl.searchParams.get("commentId");
  if (!commentId)
    return NextResponse.json(
      { success: false, error: "commentId obrigatório." },
      { status: 400 }
    );

  const admin = createAdminClient();

  const { error } = await admin
    .from("editorial_comments")
    .delete()
    .eq("id", commentId)
    .eq("content_id", id);

  if (error)
    return NextResponse.json(
      { success: false, error: "Erro ao excluir comentário." },
      { status: 500 }
    );

  return NextResponse.json({ success: true });
}

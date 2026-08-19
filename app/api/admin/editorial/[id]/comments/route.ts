import { NextResponse, after } from "next/server";
import type { NextRequest } from "next/server";
import { notifyNewEditorialComment } from "@/lib/email/notify-new-editorial-comment";
import { getEligibleNotificationRecipients } from "@/lib/data/editorial-recipients";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { createAdminClient } from "@/lib/supabase/admin";

function authorName(profile: { name?: string | null; email?: string | null } | null): string {
  if (!profile) return "Admin Vitti";
  return String(profile.name || profile.email || "Admin Vitti");
}

async function resolveUserAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, ctx: null };

  const cookieStore = await cookies();
  const activeClientId = cookieStore.get("active_client_id")?.value;
  const ctx = await loadUserContext(user.id, activeClientId);

  return { user, ctx };
}

async function validateContentAccess(contentId: string, clientId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("editorial_contents")
    .select("client_id")
    .eq("id", contentId)
    .maybeSingle();
  return !!data && String(data.client_id) === clientId;
}

// GET /api/admin/editorial/[id]/comments
// Accessible by admin (all content) and client_user (own client's content only)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { user, ctx } = await resolveUserAuth();
  if (!user || !ctx)
    return NextResponse.json({ success: false, error: "Não autenticado." }, { status: 401 });

  if (!ctx.isAdmin) {
    if (!ctx.client)
      return NextResponse.json({ success: false, error: "Acesso restrito." }, { status: 403 });
    const allowed = await validateContentAccess(id, ctx.client.id);
    if (!allowed)
      return NextResponse.json({ success: false, error: "Acesso restrito." }, { status: 403 });
  }

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("editorial_comments")
    .select("id, message, created_at, author_id")
    .eq("content_id", id)
    .order("created_at", { ascending: true });

  if (error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });

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
// Accessible by admin and client_user (own client's content only)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { user, ctx } = await resolveUserAuth();
  if (!user || !ctx)
    return NextResponse.json({ success: false, error: "Não autenticado." }, { status: 401 });

  if (!ctx.isAdmin) {
    if (!ctx.client)
      return NextResponse.json({ success: false, error: "Acesso restrito." }, { status: 403 });
    const allowed = await validateContentAccess(id, ctx.client.id);
    if (!allowed)
      return NextResponse.json({ success: false, error: "Acesso restrito." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Body inválido." }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const message = typeof b.message === "string" ? b.message.trim() : "";

  if (!message)
    return NextResponse.json(
      { success: false, error: "Mensagem não pode ser vazia." },
      { status: 400 }
    );

  // Validate notificationRecipientProfileIds
  const rawIds = b.notificationRecipientProfileIds;

  if (!Array.isArray(rawIds) || rawIds.length === 0)
    return NextResponse.json(
      { success: false, error: "Selecione pelo menos 1 destinatário para a notificação." },
      { status: 400 }
    );

  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!rawIds.every((v): v is string => typeof v === "string" && UUID_RE.test(v)))
    return NextResponse.json(
      { success: false, error: "IDs de destinatários inválidos." },
      { status: 400 }
    );

  const submittedUniqueIds = [...new Set(rawIds)];

  // ALL-OR-NOTHING: every submitted ID must belong to the eligible set
  let eligible: Awaited<ReturnType<typeof getEligibleNotificationRecipients>>;
  try {
    eligible = await getEligibleNotificationRecipients(id);
  } catch {
    return NextResponse.json(
      { success: false, error: "Erro interno ao validar destinatários." },
      { status: 500 }
    );
  }

  if (eligible === null)
    return NextResponse.json(
      { success: false, error: "Conteúdo não encontrado." },
      { status: 400 }
    );

  const eligibleSet = new Set(eligible.map((r) => r.id));
  const validatedIds = submittedUniqueIds.filter((pid) => eligibleSet.has(pid));

  if (validatedIds.length !== submittedUniqueIds.length)
    return NextResponse.json(
      {
        success: false,
        error: "Um ou mais destinatários selecionados não são válidos para este conteúdo.",
      },
      { status: 400 }
    );

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("id, name, email")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const { data: insertedRaw, error: insertError } = await admin
    .from("editorial_comments")
    .insert({ content_id: id, author_id: profile?.id ?? null, message })
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

  const resolvedAuthorName = authorName(
    profile ? { name: profile.name, email: profile.email } : null
  );

  const comment = {
    id: String(insertedRaw.id),
    message: String(insertedRaw.message),
    createdAt: String(insertedRaw.created_at),
    authorName: resolvedAuthorName,
  };

  after(() =>
    notifyNewEditorialComment({
      contentId: id,
      authorName: resolvedAuthorName,
      message,
      recipientProfileIds: validatedIds,
    })
  );

  return NextResponse.json({ success: true, comment });
}

// DELETE /api/admin/editorial/[id]/comments?commentId=xxx — admin only
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, ctx } = await resolveUserAuth();
  if (!user || !ctx)
    return NextResponse.json({ success: false, error: "Não autenticado." }, { status: 401 });
  if (!ctx.isAdmin)
    return NextResponse.json({ success: false, error: "Acesso restrito." }, { status: 403 });

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

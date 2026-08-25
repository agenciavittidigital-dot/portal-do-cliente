import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { createAdminClient } from "@/lib/supabase/admin";

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

async function validateContentAccess(
  contentId: string,
  clientId: string,
): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("editorial_contents")
    .select("client_id")
    .eq("id", contentId)
    .maybeSingle();
  return !!data && String(data.client_id) === clientId;
}

// GET /api/admin/editorial/[id]/suggestions
// Acessível por admin (todos) e client_user (somente do próprio cliente)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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
    .from("editorial_suggestions")
    .select(
      "id, field, original_start, original_end, original_text, proposed_text, status, author_id, created_at, resolved_at, resolution_note",
    )
    .eq("content_id", id)
    .order("created_at", { ascending: true });

  if (error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const authorIds = [
    ...new Set((data ?? []).map((r) => r.author_id).filter(Boolean)),
  ];
  const profilesMap = new Map<string, string>();

  if (authorIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, name, email")
      .in("id", authorIds);
    for (const p of profiles ?? []) {
      profilesMap.set(
        String(p.id),
        String(p.name || p.email || "Usuário"),
      );
    }
  }

  const suggestions = (data ?? []).map((row) => ({
    id: String(row.id),
    field: row.field as "description" | "caption",
    original_start: Number(row.original_start),
    original_end: Number(row.original_end),
    original_text: String(row.original_text),
    proposed_text: row.proposed_text ? String(row.proposed_text) : null,
    status: row.status as "pending" | "accepted" | "rejected" | "conflict",
    authorName: row.author_id
      ? (profilesMap.get(String(row.author_id)) ?? "Usuário")
      : "Usuário",
    createdAt: String(row.created_at),
    resolvedAt: row.resolved_at ? String(row.resolved_at) : null,
    resolutionNote: row.resolution_note ? String(row.resolution_note) : null,
  }));

  return NextResponse.json({ success: true, suggestions });
}

// POST /api/admin/editorial/[id]/suggestions
// Acessível por admin e client_user (somente do próprio cliente)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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

  // Validar field
  const field = b.field;
  if (field !== "description" && field !== "caption")
    return NextResponse.json({ success: false, error: "Campo inválido. Use 'description' ou 'caption'." }, { status: 400 });

  // Validar offsets (devem ser inteiros não negativos)
  const rawStart = b.original_start;
  const rawEnd = b.original_end;
  if (
    typeof rawStart !== "number" ||
    typeof rawEnd !== "number" ||
    !Number.isInteger(rawStart) ||
    !Number.isInteger(rawEnd) ||
    rawStart < 0 ||
    rawEnd <= rawStart
  )
    return NextResponse.json({ success: false, error: "Offsets inválidos." }, { status: 400 });

  const original_start = rawStart;
  const original_end = rawEnd;

  // Validar original_text (mínimo 2 caracteres)
  const original_text =
    typeof b.original_text === "string" ? b.original_text : "";
  if (original_text.length < 2)
    return NextResponse.json({
      success: false,
      error: "Trecho muito curto. Selecione ao menos 2 caracteres.",
    }, { status: 400 });

  // Validar proposed_text (max 500 chars; vazio/null = exclusão)
  let proposed_text: string | null = null;
  if (typeof b.proposed_text === "string") {
    const trimmed = b.proposed_text.trim();
    if (trimmed.length > 500)
      return NextResponse.json({
        success: false,
        error: "Texto proposto excede 500 caracteres.",
      }, { status: 400 });
    proposed_text = trimmed || null;
  }

  const admin = createAdminClient();

  // Buscar conteúdo e validar snapshot
  const { data: content, error: contentErr } = await admin
    .from("editorial_contents")
    .select("description, caption")
    .eq("id", id)
    .maybeSingle();

  if (contentErr || !content)
    return NextResponse.json({ success: false, error: "Conteúdo não encontrado." }, { status: 404 });

  const currentText: string =
    ((content as Record<string, unknown>)[field] as string | null) ?? "";

  if (original_end > currentText.length)
    return NextResponse.json({
      success: false,
      error: "Trecho fora dos limites do texto.",
    }, { status: 422 });

  const slice = currentText.slice(original_start, original_end);
  if (slice !== original_text)
    return NextResponse.json({
      success: false,
      error: "Trecho não corresponde ao texto atual. Tente novamente.",
    }, { status: 422 });

  // Buscar profile do autor
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const { data: inserted, error: insertErr } = await admin
    .from("editorial_suggestions")
    .insert({
      content_id: id,
      author_id: profile?.id ?? null,
      field,
      original_start,
      original_end,
      original_text,
      proposed_text,
    })
    .select("id")
    .single();

  if (insertErr || !inserted)
    return NextResponse.json(
      {
        success: false,
        error: insertErr?.message ?? "Erro ao salvar sugestão.",
        code: insertErr?.code,
      },
      { status: 500 },
    );

  return NextResponse.json({ success: true, id: inserted.id });
}

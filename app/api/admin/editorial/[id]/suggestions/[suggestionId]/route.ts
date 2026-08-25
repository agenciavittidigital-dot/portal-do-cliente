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
  if (!user) return { user: null, profile: null, error: "Não autenticado.", status: 401 };

  const ctx = await loadUserContext(user.id);
  if (!ctx.isAdmin)
    return { user, profile: null, error: "Acesso restrito.", status: 403 };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  return { user, profile, error: null, status: 200 };
}

// PATCH /api/admin/editorial/[id]/suggestions/[suggestionId]
// Somente Admin Vitti — accept ou reject
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; suggestionId: string }> },
) {
  const auth = await requireAdmin();
  if (auth.error)
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

  const { id, suggestionId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Body inválido." }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const action = b.action;

  if (action !== "accept" && action !== "reject")
    return NextResponse.json({ success: false, error: "Action inválida. Use 'accept' ou 'reject'." }, { status: 400 });

  const admin = createAdminClient();

  // Buscar sugestão e validar cross-content
  const { data: suggestion, error: sugErr } = await admin
    .from("editorial_suggestions")
    .select(
      "id, content_id, field, original_start, original_end, original_text, proposed_text, status",
    )
    .eq("id", suggestionId)
    .maybeSingle();

  if (sugErr || !suggestion)
    return NextResponse.json({ success: false, error: "Sugestão não encontrada." }, { status: 404 });

  if (String(suggestion.content_id) !== id)
    return NextResponse.json({ success: false, error: "Acesso restrito." }, { status: 403 });

  // Validar status permitido por ação
  if (action === "accept" && suggestion.status !== "pending")
    return NextResponse.json({ success: false, error: "Sugestão já resolvida." }, { status: 409 });

  if (
    action === "reject" &&
    suggestion.status !== "pending" &&
    suggestion.status !== "conflict"
  )
    return NextResponse.json({ success: false, error: "Sugestão já resolvida." }, { status: 409 });

  const resolvedBy = auth.profile?.id ?? null;
  const resolvedAt = new Date().toISOString();

  // ── REJEITAR ──────────────────────────────────────────────────────────────
  if (action === "reject") {
    const note =
      typeof b.note === "string" ? b.note.trim() || null : null;

    await admin
      .from("editorial_suggestions")
      .update({
        status: "rejected",
        resolved_by: resolvedBy,
        resolved_at: resolvedAt,
        resolution_note: note,
      })
      .eq("id", suggestionId);

    return NextResponse.json({ success: true });
  }

  // ── ACEITAR ───────────────────────────────────────────────────────────────

  // Buscar texto atual do conteúdo
  const { data: content, error: contentErr } = await admin
    .from("editorial_contents")
    .select("description, caption")
    .eq("id", id)
    .maybeSingle();

  if (contentErr || !content)
    return NextResponse.json({ success: false, error: "Conteúdo não encontrado." }, { status: 404 });

  const field = suggestion.field as "description" | "caption";
  const currentText: string =
    ((content as Record<string, unknown>)[field] as string | null) ?? "";

  // Validar snapshot
  const slice = currentText.slice(
    Number(suggestion.original_start),
    Number(suggestion.original_end),
  );

  if (slice !== suggestion.original_text) {
    await admin
      .from("editorial_suggestions")
      .update({ status: "conflict" })
      .eq("id", suggestionId);

    return NextResponse.json(
      {
        success: false,
        conflict: true,
        error:
          "O texto original foi alterado após esta sugestão. Revise manualmente.",
      },
      { status: 409 },
    );
  }

  // Montar novo texto
  const newText =
    currentText.slice(0, Number(suggestion.original_start)) +
    (suggestion.proposed_text ?? "") +
    currentText.slice(Number(suggestion.original_end));

  // Atualizar editorial_contents
  const { error: updateErr } = await admin
    .from("editorial_contents")
    .update({ [field]: newText || null })
    .eq("id", id);

  if (updateErr)
    return NextResponse.json({ success: false, error: "Erro ao aplicar sugestão." }, { status: 500 });

  // Marcar sugestão como accepted
  await admin
    .from("editorial_suggestions")
    .update({
      status: "accepted",
      resolved_by: resolvedBy,
      resolved_at: resolvedAt,
    })
    .eq("id", suggestionId);

  // ── REVALIDAR DEMAIS SUGESTÕES PENDING DO MESMO CAMPO ────────────────────
  // Após accept, o texto mudou. Verifica todas as outras sugestões pending
  // do mesmo content_id + field e invalida as que não correspondem mais.
  const { data: otherPending } = await admin
    .from("editorial_suggestions")
    .select("id, original_start, original_end, original_text")
    .eq("content_id", id)
    .eq("field", field)
    .eq("status", "pending")
    .neq("id", suggestionId);

  if (otherPending && otherPending.length > 0) {
    const resolvedNewText = newText ?? "";
    const toConflict = otherPending
      .filter(
        (s) =>
          resolvedNewText.slice(
            Number(s.original_start),
            Number(s.original_end),
          ) !== s.original_text,
      )
      .map((s) => s.id);

    if (toConflict.length > 0) {
      await admin
        .from("editorial_suggestions")
        .update({ status: "conflict" })
        .in("id", toConflict);
    }
  }

  return NextResponse.json({ success: true });
}

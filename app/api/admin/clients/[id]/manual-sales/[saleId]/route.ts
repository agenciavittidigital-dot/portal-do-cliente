import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { createAdminClient } from "@/lib/supabase/admin";

// PATCH /api/admin/clients/[id]/manual-sales/[saleId]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; saleId: string }> }
) {
  const { id: clientId, saleId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ success: false, error: "Não autenticado." }, { status: 401 });

  const ctx = await loadUserContext(user.id);
  if (!ctx.isAdmin)
    return NextResponse.json({ success: false, error: "Acesso restrito." }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Body inválido." }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (b.date !== undefined) {
    if (
      typeof b.date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(b.date) ||
      isNaN(Date.parse(b.date))
    )
      return NextResponse.json({ success: false, error: "Data inválida." }, { status: 400 });
    updates.date = b.date;
  }

  if (b.purchases !== undefined) {
    if (!Number.isInteger(b.purchases) || (b.purchases as number) < 1)
      return NextResponse.json(
        { success: false, error: "Quantidade deve ser um inteiro maior ou igual a 1." },
        { status: 400 }
      );
    updates.purchases = b.purchases;
  }

  if (b.purchase_value !== undefined) {
    const v = Number(b.purchase_value);
    if (!isFinite(v) || v <= 0)
      return NextResponse.json(
        { success: false, error: "Valor deve ser maior que zero." },
        { status: 400 }
      );
    updates.purchase_value = v;
  }

  if (b.campaign_id !== undefined)
    updates.campaign_id =
      typeof b.campaign_id === "string" && b.campaign_id.trim()
        ? b.campaign_id.trim()
        : null;

  if (b.campaign_name !== undefined)
    updates.campaign_name =
      typeof b.campaign_name === "string" && b.campaign_name.trim()
        ? b.campaign_name.trim()
        : null;

  if (b.notes !== undefined)
    updates.notes =
      typeof b.notes === "string" && b.notes.trim() ? b.notes.trim() : null;

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("manual_sales")
    .update(updates)
    .eq("id", saleId)
    .eq("client_id", clientId) // cross-client guard
    .select()
    .single();

  if (error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  if (!data)
    return NextResponse.json(
      { success: false, error: "Registro não encontrado." },
      { status: 404 }
    );

  return NextResponse.json({ success: true, sale: data });
}

// DELETE /api/admin/clients/[id]/manual-sales/[saleId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; saleId: string }> }
) {
  const { id: clientId, saleId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ success: false, error: "Não autenticado." }, { status: 401 });

  const ctx = await loadUserContext(user.id);
  if (!ctx.isAdmin)
    return NextResponse.json({ success: false, error: "Acesso restrito." }, { status: 403 });

  const admin = createAdminClient();

  const { error } = await admin
    .from("manual_sales")
    .delete()
    .eq("id", saleId)
    .eq("client_id", clientId); // cross-client guard

  if (error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

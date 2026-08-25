import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/admin/clients/[id]/manual-sales?channel=meta_ads
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clientId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ success: false, error: "Não autenticado." }, { status: 401 });

  const ctx = await loadUserContext(user.id);
  if (!ctx.isAdmin)
    return NextResponse.json({ success: false, error: "Acesso restrito." }, { status: 403 });

  const channel = req.nextUrl.searchParams.get("channel");
  const admin = createAdminClient();

  let query = admin
    .from("manual_sales")
    .select(
      "id, client_id, channel, date, campaign_id, campaign_name, purchases, purchase_value, notes, created_by, created_at, updated_at"
    )
    .eq("client_id", clientId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (channel) query = query.eq("channel", channel);

  const { data, error } = await query;
  if (error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // Enrich with creator name for display
  const creatorIds = [
    ...new Set((data ?? []).map((r) => r.created_by).filter(Boolean)),
  ];
  const namesMap = new Map<string, string>();

  if (creatorIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, name, email")
      .in("id", creatorIds);
    for (const p of profiles ?? []) {
      namesMap.set(String(p.id), String(p.name || p.email || "Admin"));
    }
  }

  const sales = (data ?? []).map((r) => ({
    ...r,
    created_by_name: r.created_by
      ? (namesMap.get(String(r.created_by)) ?? "Admin")
      : "Admin",
  }));

  return NextResponse.json({ success: true, sales });
}

// POST /api/admin/clients/[id]/manual-sales
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clientId } = await params;

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
  const channel = b.channel;
  const date = b.date;
  const purchases = b.purchases;
  const purchase_value = b.purchase_value;

  if (channel !== "meta_ads" && channel !== "google_ads")
    return NextResponse.json({ success: false, error: "Canal inválido." }, { status: 400 });

  if (
    !date ||
    typeof date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    isNaN(Date.parse(date))
  )
    return NextResponse.json({ success: false, error: "Data inválida." }, { status: 400 });

  if (!Number.isInteger(purchases) || (purchases as number) < 1)
    return NextResponse.json(
      { success: false, error: "Quantidade de vendas deve ser um inteiro maior ou igual a 1." },
      { status: 400 }
    );

  const valueNum = Number(purchase_value);
  if (!isFinite(valueNum) || valueNum <= 0)
    return NextResponse.json(
      { success: false, error: "Valor da venda deve ser maior que zero." },
      { status: 400 }
    );

  const admin = createAdminClient();

  // Verify client exists
  const { data: client } = await admin
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .maybeSingle();
  if (!client)
    return NextResponse.json({ success: false, error: "Cliente não encontrado." }, { status: 404 });

  // Resolve admin profile for audit trail
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const { data: inserted, error: insertError } = await admin
    .from("manual_sales")
    .insert({
      client_id: clientId,
      channel,
      date,
      campaign_id:
        typeof b.campaign_id === "string" && b.campaign_id.trim()
          ? b.campaign_id.trim()
          : null,
      campaign_name:
        typeof b.campaign_name === "string" && b.campaign_name.trim()
          ? b.campaign_name.trim()
          : null,
      purchases: purchases as number,
      purchase_value: valueNum,
      notes:
        typeof b.notes === "string" && b.notes.trim() ? b.notes.trim() : null,
      created_by: profile?.id ?? null,
    })
    .select()
    .single();

  if (insertError || !inserted)
    return NextResponse.json(
      { success: false, error: insertError?.message ?? "Erro ao inserir." },
      { status: 500 }
    );

  return NextResponse.json({ success: true, sale: inserted });
}

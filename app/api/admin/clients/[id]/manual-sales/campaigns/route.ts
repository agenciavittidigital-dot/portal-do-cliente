import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/admin/clients/[id]/manual-sales/campaigns?channel=meta_ads
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
  if (channel !== "meta_ads" && channel !== "google_ads")
    return NextResponse.json({ success: false, error: "Canal inválido." }, { status: 400 });

  const admin = createAdminClient();

  // Reutiliza exatamente os filtros anti-demo da função correspondente:
  // - meta_ads: account_name + campaign_id (igual a loadMetaAdsCampaigns)
  // - google_ads: nenhum filtro anti-demo (igual a loadGoogleAdsCampaigns)
  const baseQuery = admin
    .from("performance_daily")
    .select("campaign_id, campaign_name")
    .eq("client_id", clientId)
    .eq("channel", channel)
    .not("campaign_id", "is", null)
    .order("date", { ascending: false });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query: any = channel === "meta_ads"
    ? (baseQuery as any)
        .not("account_name", "ilike", "%demo%")
        .not("campaign_id", "ilike", "%demo%")
    : baseQuery;

  const { data, error } = await query;
  if (error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // Deduplica por campaign_id mantendo o nome da linha mais recente (ordenado DESC por date)
  const seen = new Map<string, string | null>();
  for (const row of data ?? []) {
    const id = String(row.campaign_id);
    if (!seen.has(id)) {
      seen.set(id, row.campaign_name ?? null);
    } else if (!seen.get(id) && row.campaign_name) {
      seen.set(id, row.campaign_name);
    }
  }

  const campaigns = [...seen.entries()].map(([campaign_id, campaign_name]) => ({
    campaign_id,
    campaign_name,
  }));

  return NextResponse.json({ success: true, campaigns });
}

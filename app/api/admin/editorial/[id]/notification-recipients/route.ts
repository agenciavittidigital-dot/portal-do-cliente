import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEligibleNotificationRecipients } from "@/lib/data/editorial-recipients";

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

// GET /api/admin/editorial/[id]/notification-recipients
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

  try {
    const recipients = await getEligibleNotificationRecipients(id);

    if (recipients === null)
      return NextResponse.json({ success: false, error: "Conteúdo não encontrado." }, { status: 404 });

    return NextResponse.json({ success: true, recipients });
  } catch {
    return NextResponse.json(
      { success: false, error: "Erro ao buscar destinatários." },
      { status: 500 }
    );
  }
}

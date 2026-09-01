import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { listEditorialContents } from "@/lib/data/editorial";
import { isValidEditorialPlatform } from "@/lib/editorial-platforms";
import { stripEditorialRichText } from "@/lib/editorial-rich-text";

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

  // Validate platforms
  const rawPlatforms = b.platforms;
  let platforms: string[] = [];
  if (rawPlatforms !== undefined) {
    if (!Array.isArray(rawPlatforms)) {
      return NextResponse.json(
        { success: false, error: "platforms deve ser um array." },
        { status: 400 }
      );
    }
    const unknowns = (rawPlatforms as unknown[]).filter((v) => !isValidEditorialPlatform(v));
    if (unknowns.length > 0) {
      return NextResponse.json(
        { success: false, error: `Plataforma inválida: ${(unknowns as string[]).join(", ")}` },
        { status: 400 }
      );
    }
    platforms = [...new Set(rawPlatforms as string[])];
  }

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("auth_user_id", auth.user!.id)
    .maybeSingle();

  // Rich fields are optional; derive canonical if only rich is provided.
  const rawDescription     = b.description     ? String(b.description).trim()     : null;
  const rawDescriptionRich = b.description_rich ? String(b.description_rich).trim() : null;
  const rawCaption         = b.caption         ? String(b.caption).trim()         : null;
  const rawCaptionRich     = b.caption_rich     ? String(b.caption_rich).trim()     : null;

  const descriptionCanon = rawDescription ?? (rawDescriptionRich ? stripEditorialRichText(rawDescriptionRich) : null);
  const captionCanon     = rawCaption     ?? (rawCaptionRich     ? stripEditorialRichText(rawCaptionRich)     : null);

  const { data, error } = await admin
    .from("editorial_contents")
    .insert({
      client_id: b.client_id,
      category_id: b.category_id ?? null,
      status_id: b.status_id ?? null,
      responsible_id: b.responsible_id ?? null,
      title: String(b.title).trim(),
      description:      descriptionCanon,
      description_rich: rawDescriptionRich,
      caption:          captionCanon,
      caption_rich:     rawCaptionRich,
      scheduled_at: b.scheduled_at ?? null,
      delivery_at: b.delivery_at ?? null,
      video_url: b.video_url ? String(b.video_url).trim() : null,
      platforms,
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

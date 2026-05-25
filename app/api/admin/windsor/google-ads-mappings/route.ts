import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadUserContext } from "@/lib/data/user-context";

export interface GoogleAdsMappingApiResponse {
  success: boolean;
  integrationId?: string;
  error?: string;
  detail?: string;
}

function slugify(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 60);
}

export async function POST(req: NextRequest): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json<GoogleAdsMappingApiResponse>(
      { success: false, error: "Não autenticado." },
      { status: 401 }
    );
  }

  const ctx = await loadUserContext(user.id);
  if (!ctx.isAdmin) {
    return NextResponse.json<GoogleAdsMappingApiResponse>(
      { success: false, error: "Acesso restrito a administradores Vitti." },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<GoogleAdsMappingApiResponse>(
      { success: false, error: "Body inválido." },
      { status: 400 }
    );
  }

  const b = body as Record<string, unknown>;
  const clientId = typeof b.clientId === "string" && b.clientId.trim() ? b.clientId.trim() : null;
  const accountName =
    typeof b.accountName === "string" && b.accountName.trim() ? b.accountName.trim() : null;

  if (!clientId || !accountName) {
    return NextResponse.json<GoogleAdsMappingApiResponse>(
      { success: false, error: "clientId e accountName são obrigatórios." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Verifica se o cliente existe
  const { data: clientRow } = await admin
    .from("clients")
    .select("id, name")
    .eq("id", clientId)
    .single();

  if (!clientRow) {
    return NextResponse.json<GoogleAdsMappingApiResponse>(
      { success: false, error: "Cliente não encontrado." },
      { status: 404 }
    );
  }

  const accountId = slugify(accountName);

  // Verifica mapeamento existente
  const { data: existing } = await admin
    .from("client_integrations")
    .select("id")
    .eq("provider", "windsor")
    .eq("channel", "google_ads")
    .eq("account_name", accountName)
    .maybeSingle();

  const now = new Date().toISOString();

  if (existing?.id) {
    // Atualiza
    const { error: updateError } = await admin
      .from("client_integrations")
      .update({
        client_id: clientId,
        account_id: accountId,
        status: "active",
        settings: {
          source: "windsor_all",
          channel: "google_ads",
          matched_by: "account_name",
          updated_at: now,
        },
        updated_at: now,
      })
      .eq("id", existing.id);

    if (updateError) {
      return NextResponse.json<GoogleAdsMappingApiResponse>(
        { success: false, error: "Erro ao atualizar mapeamento.", detail: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json<GoogleAdsMappingApiResponse>({
      success: true,
      integrationId: existing.id,
    });
  }

  // Insere novo
  const { data: inserted, error: insertError } = await admin
    .from("client_integrations")
    .insert({
      client_id: clientId,
      provider: "windsor",
      channel: "google_ads",
      account_id: accountId,
      account_name: accountName,
      status: "active",
      settings: {
        source: "windsor_all",
        channel: "google_ads",
        matched_by: "account_name",
        created_at: now,
      },
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    return NextResponse.json<GoogleAdsMappingApiResponse>(
      { success: false, error: "Erro ao criar mapeamento.", detail: insertError?.message },
      { status: 500 }
    );
  }

  return NextResponse.json<GoogleAdsMappingApiResponse>({
    success: true,
    integrationId: String(inserted.id),
  });
}

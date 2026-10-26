import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { listMetaIntegrations } from "@/lib/data/meta-integrations";
import type { MetaIntegrationRow } from "@/lib/data/meta-integrations";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MetaIntegrationsApiResponse {
  success: boolean;
  integrations?: MetaIntegrationRow[];
  error?: string;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json<MetaIntegrationsApiResponse>(
      { success: false, error: "Não autenticado." },
      { status: 401 }
    );
  }

  const ctx = await loadUserContext(user.id);
  if (!ctx.isAdmin) {
    return NextResponse.json<MetaIntegrationsApiResponse>(
      { success: false, error: "Acesso restrito a administradores Vitti." },
      { status: 403 }
    );
  }

  const clientId = request.nextUrl.searchParams.get("clientId") ?? undefined;

  try {
    const integrations = await listMetaIntegrations(clientId);
    return NextResponse.json<MetaIntegrationsApiResponse>({
      success: true,
      integrations,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao carregar integrações.";
    return NextResponse.json<MetaIntegrationsApiResponse>(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { listClientDashboardConfig } from "@/lib/data/dashboards-admin";
import type { ClientDashboardConfig } from "@/lib/data/dashboards-admin";

export interface DashboardsApiResponse {
  success: boolean;
  config?: ClientDashboardConfig;
  error?: string;
}

async function requireAdmin(): Promise<{ userId: string } | { error: Response }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error: NextResponse.json<DashboardsApiResponse>(
        { success: false, error: "Não autenticado." },
        { status: 401 }
      ),
    };
  }
  const ctx = await loadUserContext(user.id);
  if (!ctx.isAdmin) {
    return {
      error: NextResponse.json<DashboardsApiResponse>(
        { success: false, error: "Acesso restrito a administradores Vitti." },
        { status: 403 }
      ),
    };
  }
  return { userId: user.id };
}

export async function GET(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const clientId = req.nextUrl.searchParams.get("clientId");
  if (!clientId) {
    return NextResponse.json<DashboardsApiResponse>(
      { success: false, error: "clientId é obrigatório." },
      { status: 400 }
    );
  }

  const config = await listClientDashboardConfig(clientId);
  if (!config) {
    return NextResponse.json<DashboardsApiResponse>(
      { success: false, error: "Cliente não encontrado." },
      { status: 404 }
    );
  }

  return NextResponse.json<DashboardsApiResponse>({ success: true, config });
}

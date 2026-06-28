import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { listAllMeetingRequests } from "@/lib/data/meeting-requests-admin";
import type { AdminMeetingRequestRow } from "@/lib/data/meeting-requests-admin";

export interface MeetingRequestListResponse {
  success: boolean;
  requests?: AdminMeetingRequestRow[];
  error?: string;
  detail?: string;
}

async function requireAdmin(): Promise<{ userId: string } | { error: Response }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error: NextResponse.json<MeetingRequestListResponse>(
        { success: false, error: "Não autenticado." },
        { status: 401 }
      ),
    };
  }
  const ctx = await loadUserContext(user.id);
  if (!ctx.isAdmin) {
    return {
      error: NextResponse.json<MeetingRequestListResponse>(
        { success: false, error: "Acesso restrito a administradores Vitti." },
        { status: 403 }
      ),
    };
  }
  return { userId: user.id };
}

// GET /api/admin/meeting-requests
export async function GET(): Promise<Response> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  try {
    const requests = await listAllMeetingRequests();
    return NextResponse.json<MeetingRequestListResponse>({ success: true, requests });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Erro desconhecido.";
    return NextResponse.json<MeetingRequestListResponse>(
      { success: false, error: "Erro ao listar solicitações.", detail },
      { status: 500 }
    );
  }
}

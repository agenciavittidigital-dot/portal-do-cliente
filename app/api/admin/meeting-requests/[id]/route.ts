import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { updateMeetingRequestStatus } from "@/lib/data/meeting-requests-admin";
import type { MeetingRequestStatus } from "@/lib/data/meeting-requests-admin";

export interface MeetingRequestPatchResponse {
  success: boolean;
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
      error: NextResponse.json<MeetingRequestPatchResponse>(
        { success: false, error: "Não autenticado." },
        { status: 401 }
      ),
    };
  }
  const ctx = await loadUserContext(user.id);
  if (!ctx.isAdmin) {
    return {
      error: NextResponse.json<MeetingRequestPatchResponse>(
        { success: false, error: "Acesso restrito a administradores Vitti." },
        { status: 403 }
      ),
    };
  }
  return { userId: user.id };
}

const VALID_STATUSES: MeetingRequestStatus[] = [
  "pending",
  "scheduled",
  "cancelled",
  "done",
];

// PATCH /api/admin/meeting-requests/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  if (!id) {
    return NextResponse.json<MeetingRequestPatchResponse>(
      { success: false, error: "ID é obrigatório." },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<MeetingRequestPatchResponse>(
      { success: false, error: "Body inválido." },
      { status: 400 }
    );
  }

  const b = body as Record<string, unknown>;
  const status =
    typeof b.status === "string" &&
    VALID_STATUSES.includes(b.status as MeetingRequestStatus)
      ? (b.status as MeetingRequestStatus)
      : null;

  if (!status) {
    return NextResponse.json<MeetingRequestPatchResponse>(
      { success: false, error: "Status inválido." },
      { status: 400 }
    );
  }

  try {
    await updateMeetingRequestStatus(id, status);
    return NextResponse.json<MeetingRequestPatchResponse>({ success: true });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Erro desconhecido.";
    return NextResponse.json<MeetingRequestPatchResponse>(
      { success: false, error: "Erro ao atualizar status.", detail },
      { status: 500 }
    );
  }
}

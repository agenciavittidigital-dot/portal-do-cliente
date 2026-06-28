import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { updateScheduledCall } from "@/lib/data/scheduled-calls-admin";
import type {
  AdminScheduledCallRow,
  ScheduledCallStatus,
  ScheduledCallType,
} from "@/lib/data/scheduled-calls-admin";

export interface ScheduledCallPatchResponse {
  success: boolean;
  call?: AdminScheduledCallRow;
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
      error: NextResponse.json<ScheduledCallPatchResponse>(
        { success: false, error: "Não autenticado." },
        { status: 401 }
      ),
    };
  }
  const ctx = await loadUserContext(user.id);
  if (!ctx.isAdmin) {
    return {
      error: NextResponse.json<ScheduledCallPatchResponse>(
        { success: false, error: "Acesso restrito a administradores Vitti." },
        { status: 403 }
      ),
    };
  }
  return { userId: user.id };
}

const VALID_TYPES: ScheduledCallType[] = [
  "performance",
  "alignment",
  "planning",
  "onboarding",
  "report_presentation",
  "other",
];

// PATCH /api/admin/scheduled-calls/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  if (!id) {
    return NextResponse.json<ScheduledCallPatchResponse>(
      { success: false, error: "ID é obrigatório." },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<ScheduledCallPatchResponse>(
      { success: false, error: "Body inválido." },
      { status: 400 }
    );
  }

  const b = body as Record<string, unknown>;
  const patch: Parameters<typeof updateScheduledCall>[1] = {};

  if (typeof b.title === "string" && b.title.trim()) patch.title = b.title.trim();
  if (
    typeof b.callType === "string" &&
    VALID_TYPES.includes(b.callType as ScheduledCallType)
  ) {
    patch.callType = b.callType as ScheduledCallType;
  }
  if (typeof b.scheduledAt === "string" && b.scheduledAt.trim())
    patch.scheduledAt = b.scheduledAt.trim();
  if ("meetingUrl" in b)
    patch.meetingUrl =
      typeof b.meetingUrl === "string" && b.meetingUrl.trim()
        ? b.meetingUrl.trim()
        : null;
  if (
    b.status === "upcoming" ||
    b.status === "done" ||
    b.status === "cancelled"
  ) {
    patch.status = b.status as ScheduledCallStatus;
  }

  try {
    const call = await updateScheduledCall(id, patch);
    return NextResponse.json<ScheduledCallPatchResponse>({ success: true, call });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Erro desconhecido.";
    return NextResponse.json<ScheduledCallPatchResponse>(
      { success: false, error: "Erro ao atualizar agendamento.", detail },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import {
  listAllScheduledCalls,
  createScheduledCall,
} from "@/lib/data/scheduled-calls-admin";
import type {
  AdminScheduledCallRow,
  ScheduledCallStatus,
  ScheduledCallType,
} from "@/lib/data/scheduled-calls-admin";

export interface ScheduledCallListResponse {
  success: boolean;
  calls?: AdminScheduledCallRow[];
  error?: string;
  detail?: string;
}

export interface ScheduledCallCreateResponse {
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
      error: NextResponse.json(
        { success: false, error: "Não autenticado." },
        { status: 401 }
      ),
    };
  }
  const ctx = await loadUserContext(user.id);
  if (!ctx.isAdmin) {
    return {
      error: NextResponse.json(
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

// GET /api/admin/scheduled-calls
export async function GET(): Promise<Response> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  try {
    const calls = await listAllScheduledCalls();
    return NextResponse.json<ScheduledCallListResponse>({ success: true, calls });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Erro desconhecido.";
    return NextResponse.json<ScheduledCallListResponse>(
      { success: false, error: "Erro ao listar agendamentos.", detail },
      { status: 500 }
    );
  }
}

// POST /api/admin/scheduled-calls
export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<ScheduledCallCreateResponse>(
      { success: false, error: "Body inválido." },
      { status: 400 }
    );
  }

  const b = body as Record<string, unknown>;

  const clientId =
    typeof b.clientId === "string" && b.clientId.trim()
      ? b.clientId.trim()
      : null;
  if (!clientId) {
    return NextResponse.json<ScheduledCallCreateResponse>(
      { success: false, error: "clientId é obrigatório." },
      { status: 400 }
    );
  }

  const title =
    typeof b.title === "string" && b.title.trim() ? b.title.trim() : null;
  if (!title) {
    return NextResponse.json<ScheduledCallCreateResponse>(
      { success: false, error: "Título é obrigatório." },
      { status: 400 }
    );
  }

  const scheduledAt =
    typeof b.scheduledAt === "string" && b.scheduledAt.trim()
      ? b.scheduledAt.trim()
      : null;
  if (!scheduledAt) {
    return NextResponse.json<ScheduledCallCreateResponse>(
      { success: false, error: "Data/hora é obrigatória." },
      { status: 400 }
    );
  }

  const callType: ScheduledCallType =
    typeof b.callType === "string" &&
    VALID_TYPES.includes(b.callType as ScheduledCallType)
      ? (b.callType as ScheduledCallType)
      : "alignment";

  const status: ScheduledCallStatus =
    b.status === "done" || b.status === "cancelled"
      ? (b.status as ScheduledCallStatus)
      : "upcoming";

  const meetingUrl =
    typeof b.meetingUrl === "string" && b.meetingUrl.trim()
      ? b.meetingUrl.trim()
      : null;

  try {
    const call = await createScheduledCall({
      clientId,
      title,
      callType,
      scheduledAt,
      meetingUrl,
      status,
    });
    return NextResponse.json<ScheduledCallCreateResponse>(
      { success: true, call },
      { status: 201 }
    );
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Erro desconhecido.";
    return NextResponse.json<ScheduledCallCreateResponse>(
      { success: false, error: "Erro ao criar agendamento.", detail },
      { status: 500 }
    );
  }
}

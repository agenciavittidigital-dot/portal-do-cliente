import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { listCallsByClient, createCall } from "@/lib/data/calls-admin";
import type { AdminCallRow, CallType, CallStatus } from "@/lib/data/calls-admin";

export interface CallListResponse {
  success: boolean;
  calls?: AdminCallRow[];
  error?: string;
  detail?: string;
}

export interface CallCreateResponse {
  success: boolean;
  call?: AdminCallRow;
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
      error: NextResponse.json<CallListResponse>(
        { success: false, error: "Não autenticado." },
        { status: 401 }
      ),
    };
  }
  const ctx = await loadUserContext(user.id);
  if (!ctx.isAdmin) {
    return {
      error: NextResponse.json<CallListResponse>(
        { success: false, error: "Acesso restrito a administradores Vitti." },
        { status: 403 }
      ),
    };
  }
  return { userId: user.id };
}

const VALID_TYPES: CallType[] = [
  "performance",
  "alignment",
  "planning",
  "onboarding",
  "report_presentation",
  "other",
];

const VALID_STATUSES: CallStatus[] = ["draft", "published", "archived"];

// GET /api/admin/calls?clientId=...
export async function GET(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const clientId = new URL(req.url).searchParams.get("clientId");
  if (!clientId) {
    return NextResponse.json<CallListResponse>(
      { success: false, error: "clientId é obrigatório." },
      { status: 400 }
    );
  }

  try {
    const calls = await listCallsByClient(clientId);
    return NextResponse.json<CallListResponse>({ success: true, calls });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Erro desconhecido.";
    return NextResponse.json<CallListResponse>(
      { success: false, error: "Erro ao listar calls.", detail },
      { status: 500 }
    );
  }
}

// POST /api/admin/calls
export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<CallCreateResponse>(
      { success: false, error: "Body inválido." },
      { status: 400 }
    );
  }

  const b = body as Record<string, unknown>;

  const clientId = typeof b.clientId === "string" && b.clientId.trim() ? b.clientId.trim() : null;
  if (!clientId) {
    return NextResponse.json<CallCreateResponse>(
      { success: false, error: "clientId é obrigatório." },
      { status: 400 }
    );
  }

  const title = typeof b.title === "string" && b.title.trim() ? b.title.trim() : null;
  if (!title) {
    return NextResponse.json<CallCreateResponse>(
      { success: false, error: "Título é obrigatório." },
      { status: 400 }
    );
  }

  const callDate = typeof b.callDate === "string" && b.callDate.trim() ? b.callDate.trim() : null;
  if (!callDate) {
    return NextResponse.json<CallCreateResponse>(
      { success: false, error: "Data da call é obrigatória." },
      { status: 400 }
    );
  }

  const callType: CallType =
    typeof b.callType === "string" && VALID_TYPES.includes(b.callType as CallType)
      ? (b.callType as CallType)
      : "alignment";

  const status: CallStatus =
    typeof b.status === "string" && VALID_STATUSES.includes(b.status as CallStatus)
      ? (b.status as CallStatus)
      : "draft";

  const description =
    typeof b.description === "string" && b.description.trim() ? b.description.trim() : null;
  const summary =
    typeof b.summary === "string" && b.summary.trim() ? b.summary.trim() : null;
  const recordingUrl =
    typeof b.recordingUrl === "string" && b.recordingUrl.trim() ? b.recordingUrl.trim() : null;
  const durationMinutes =
    typeof b.durationMinutes === "number" && b.durationMinutes > 0
      ? Math.round(b.durationMinutes)
      : null;

  try {
    const call = await createCall({
      clientId,
      title,
      callDate,
      callType,
      status,
      description,
      summary,
      recordingUrl,
      durationMinutes,
    });
    return NextResponse.json<CallCreateResponse>({ success: true, call }, { status: 201 });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Erro desconhecido.";
    return NextResponse.json<CallCreateResponse>(
      { success: false, error: "Erro ao criar call.", detail },
      { status: 500 }
    );
  }
}

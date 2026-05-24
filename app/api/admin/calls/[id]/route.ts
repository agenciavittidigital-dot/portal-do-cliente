import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { updateCall } from "@/lib/data/calls-admin";
import type { AdminCallRow, CallType, CallStatus } from "@/lib/data/calls-admin";

export interface CallPatchResponse {
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
      error: NextResponse.json<CallPatchResponse>(
        { success: false, error: "Não autenticado." },
        { status: 401 }
      ),
    };
  }
  const ctx = await loadUserContext(user.id);
  if (!ctx.isAdmin) {
    return {
      error: NextResponse.json<CallPatchResponse>(
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

// PATCH /api/admin/calls/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  if (!id) {
    return NextResponse.json<CallPatchResponse>(
      { success: false, error: "ID inválido." },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<CallPatchResponse>(
      { success: false, error: "Body inválido." },
      { status: 400 }
    );
  }

  const b = body as Record<string, unknown>;
  const patch: Parameters<typeof updateCall>[1] = {};

  if (typeof b.title === "string" && b.title.trim()) patch.title = b.title.trim();
  if ("description" in b) {
    patch.description =
      typeof b.description === "string" && b.description.trim() ? b.description.trim() : null;
  }
  if ("summary" in b) {
    patch.summary =
      typeof b.summary === "string" && b.summary.trim() ? b.summary.trim() : null;
  }
  if ("recordingUrl" in b) {
    patch.recordingUrl =
      typeof b.recordingUrl === "string" && b.recordingUrl.trim()
        ? b.recordingUrl.trim()
        : null;
  }
  if (typeof b.callType === "string" && VALID_TYPES.includes(b.callType as CallType)) {
    patch.callType = b.callType as CallType;
  }
  if (typeof b.callDate === "string" && b.callDate.trim()) {
    patch.callDate = b.callDate.trim();
  }
  if ("durationMinutes" in b) {
    patch.durationMinutes =
      typeof b.durationMinutes === "number" && b.durationMinutes > 0
        ? Math.round(b.durationMinutes)
        : null;
  }
  if (typeof b.status === "string" && VALID_STATUSES.includes(b.status as CallStatus)) {
    patch.status = b.status as CallStatus;
  }

  try {
    const call = await updateCall(id, patch);
    return NextResponse.json<CallPatchResponse>({ success: true, call });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Erro desconhecido.";
    return NextResponse.json<CallPatchResponse>(
      { success: false, error: "Erro ao atualizar call.", detail },
      { status: 500 }
    );
  }
}

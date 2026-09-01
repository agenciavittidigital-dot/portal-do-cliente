import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import {
  getPaymentById,
  updatePayment,
  markPaymentAsPaid,
  deletePayment,
  resolvePaymentMethod,
} from "@/lib/data/payments-admin";
import type { AdminPaymentRow, PaymentStatus } from "@/lib/data/payments-admin";
import { deletePortalFile } from "@/lib/storage/portal-files";

// ── Response types ─────────────────────────────────────────────────────────────

export interface PaymentPatchResponse {
  success: boolean;
  payment?: AdminPaymentRow;
  error?: string;
  detail?: string;
}

export interface PaymentDeleteResponse {
  success: boolean;
  error?: string;
  detail?: string;
}

// ── Auth guard ─────────────────────────────────────────────────────────────────

async function requireAdmin(): Promise<{ userId: string } | { error: Response }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return {
      error: NextResponse.json<PaymentPatchResponse>(
        { success: false, error: "Não autenticado." },
        { status: 401 }
      ),
    };
  }
  const ctx = await loadUserContext(user.id);
  if (!ctx.isAdmin) {
    return {
      error: NextResponse.json<PaymentPatchResponse>(
        { success: false, error: "Acesso restrito a administradores Vitti." },
        { status: 403 }
      ),
    };
  }
  return { userId: user.id };
}

const VALID_STATUSES: PaymentStatus[] = [
  "pending", "paid", "overdue", "cancelled", "failed",
];

// ── PATCH /api/admin/finance/payments/[id] ─────────────────────────────────────
// Body: { action: "mark_paid" } OR update fields

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  if (!id) {
    return NextResponse.json<PaymentPatchResponse>(
      { success: false, error: "ID inválido." },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<PaymentPatchResponse>(
      { success: false, error: "Body inválido." },
      { status: 400 }
    );
  }

  const b = body as Record<string, unknown>;

  // Quick action: mark as paid
  if (b.action === "mark_paid") {
    try {
      const payment = await markPaymentAsPaid(id);
      return NextResponse.json<PaymentPatchResponse>({ success: true, payment });
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Erro desconhecido.";
      return NextResponse.json<PaymentPatchResponse>(
        { success: false, error: "Erro ao marcar pagamento como pago.", detail },
        { status: 500 }
      );
    }
  }

  // General metadata update
  const patch: Parameters<typeof updatePayment>[1] = {};

  if (typeof b.title === "string" && b.title.trim()) patch.title = b.title.trim();
  if ("description" in b) {
    patch.description =
      typeof b.description === "string" && b.description.trim()
        ? b.description.trim()
        : null;
  }
  if ("referenceMonth" in b) {
    patch.referenceMonth =
      typeof b.referenceMonth === "string" && b.referenceMonth.trim()
        ? b.referenceMonth.trim()
        : null;
  }
  if (typeof b.amount === "number" && !isNaN(b.amount) && b.amount > 0) {
    patch.amount = b.amount;
  }
  if (typeof b.dueDate === "string" && b.dueDate.trim()) {
    patch.dueDate = b.dueDate.trim();
  }
  if (
    typeof b.status === "string" &&
    VALID_STATUSES.includes(b.status as PaymentStatus)
  ) {
    patch.status = b.status as PaymentStatus;
  }
  if ("paymentMethod" in b || "pixCode" in b || "boletoUrl" in b || "digitableLine" in b) {
    patch.paymentMethod = resolvePaymentMethod(
      typeof b.paymentMethod === "string" ? b.paymentMethod.trim() || null : null,
      typeof b.pixCode         === "string" ? b.pixCode.trim()         || null : null,
      null, // boletoFilePath não é atualizável via PATCH
      typeof b.boletoUrl       === "string" ? b.boletoUrl.trim()       || null : null,
      typeof b.digitableLine   === "string" ? b.digitableLine.trim()   || null : null,
    );
  }
  if ("boletoUrl" in b) {
    patch.boletoUrl =
      typeof b.boletoUrl === "string" && b.boletoUrl.trim()
        ? b.boletoUrl.trim()
        : null;
  }
  if ("digitableLine" in b) {
    patch.digitableLine =
      typeof b.digitableLine === "string" && b.digitableLine.trim()
        ? b.digitableLine.trim()
        : null;
  }
  if ("pixCode" in b) {
    patch.pixCode =
      typeof b.pixCode === "string" && b.pixCode.trim()
        ? b.pixCode.trim()
        : null;
  }

  try {
    const payment = await updatePayment(id, patch);
    return NextResponse.json<PaymentPatchResponse>({ success: true, payment });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Erro desconhecido.";
    return NextResponse.json<PaymentPatchResponse>(
      { success: false, error: "Erro ao atualizar pagamento.", detail },
      { status: 500 }
    );
  }
}

// ── DELETE /api/admin/finance/payments/[id] ────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  if (!id) {
    return NextResponse.json<PaymentDeleteResponse>(
      { success: false, error: "ID inválido." },
      { status: 400 }
    );
  }

  try {
    const payment = await getPaymentById(id);
    if (!payment) {
      return NextResponse.json<PaymentDeleteResponse>(
        { success: false, error: "Pagamento não encontrado." },
        { status: 404 }
      );
    }

    await deletePayment(id);

    if (payment.boletoFilePath) {
      await deletePortalFile(payment.boletoFilePath).catch(() => {});
    }

    return NextResponse.json<PaymentDeleteResponse>({ success: true });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Erro desconhecido.";
    return NextResponse.json<PaymentDeleteResponse>(
      { success: false, error: "Erro ao excluir pagamento.", detail },
      { status: 500 }
    );
  }
}

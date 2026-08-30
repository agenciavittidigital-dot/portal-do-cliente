import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { listPaymentsByClient, createPayment } from "@/lib/data/payments-admin";
import type { AdminPaymentRow, PaymentStatus } from "@/lib/data/payments-admin";
import { uploadPortalFile, deletePortalFile } from "@/lib/storage/portal-files";

// ── Response types ─────────────────────────────────────────────────────────────

export interface PaymentListResponse {
  success: boolean;
  payments?: AdminPaymentRow[];
  error?: string;
  detail?: string;
}

export interface PaymentCreateResponse {
  success: boolean;
  payment?: AdminPaymentRow;
  error?: string;
  detail?: string;
}

// ── Auth guard ─────────────────────────────────────────────────────────────────

async function requireAdmin(): Promise<{ userId: string } | { error: Response }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return {
      error: NextResponse.json<PaymentListResponse>(
        { success: false, error: "Não autenticado." },
        { status: 401 }
      ),
    };
  }
  const ctx = await loadUserContext(user.id);
  if (!ctx.isAdmin) {
    return {
      error: NextResponse.json<PaymentListResponse>(
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

function getString(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function resolvePaymentMethodForCreate(
  explicit: string | null,
  pixCode: string | null,
  boletoFilePath: string | null,
  boletoUrl: string | null,
  digitableLine: string | null,
): string | null {
  if (explicit) return explicit;
  if (pixCode) return "pix";
  if (boletoFilePath || boletoUrl || digitableLine) return "boleto";
  return null;
}

// ── GET /api/admin/finance/payments?clientId=... ───────────────────────────────

export async function GET(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const clientId = new URL(req.url).searchParams.get("clientId");
  if (!clientId) {
    return NextResponse.json<PaymentListResponse>(
      { success: false, error: "clientId é obrigatório." },
      { status: 400 }
    );
  }

  try {
    const payments = await listPaymentsByClient(clientId);
    return NextResponse.json<PaymentListResponse>({ success: true, payments });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Erro desconhecido.";
    return NextResponse.json<PaymentListResponse>(
      { success: false, error: "Erro ao listar pagamentos.", detail },
      { status: 500 }
    );
  }
}

// ── POST /api/admin/finance/payments — multipart/form-data ────────────────────

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  let fd: FormData;
  try {
    fd = await req.formData();
  } catch {
    return NextResponse.json<PaymentCreateResponse>(
      { success: false, error: "Falha ao processar o formulário." },
      { status: 400 }
    );
  }

  const clientId = getString(fd, "clientId");
  if (!clientId) {
    return NextResponse.json<PaymentCreateResponse>(
      { success: false, error: "clientId é obrigatório." },
      { status: 400 }
    );
  }

  const title = getString(fd, "title");
  if (!title) {
    return NextResponse.json<PaymentCreateResponse>(
      { success: false, error: "Título é obrigatório." },
      { status: 400 }
    );
  }

  const rawAmount = fd.get("amount");
  const amount =
    typeof rawAmount === "string" && rawAmount.trim() && !isNaN(Number(rawAmount))
      ? Number(rawAmount)
      : null;
  if (amount === null || amount <= 0) {
    return NextResponse.json<PaymentCreateResponse>(
      { success: false, error: "Valor deve ser maior que zero." },
      { status: 400 }
    );
  }

  const dueDate = getString(fd, "dueDate");
  if (!dueDate) {
    return NextResponse.json<PaymentCreateResponse>(
      { success: false, error: "Data de vencimento é obrigatória." },
      { status: 400 }
    );
  }

  const rawStatus = fd.get("status");
  const status: PaymentStatus =
    typeof rawStatus === "string" &&
    VALID_STATUSES.includes(rawStatus as PaymentStatus)
      ? (rawStatus as PaymentStatus)
      : "pending";

  const description    = getString(fd, "description");
  const referenceMonth = getString(fd, "referenceMonth");
  const paymentMethod  = getString(fd, "paymentMethod");
  const boletoUrl      = getString(fd, "boletoUrl");
  const digitableLine  = getString(fd, "digitableLine");
  const pixCode        = getString(fd, "pixCode");

  // Optional file upload
  let boletoFilePath: string | null = null;
  const file = fd.get("file");
  if (file instanceof File && file.size > 0) {
    try {
      const uploaded = await uploadPortalFile(
        file,
        `clients/${clientId}/payments`
      );
      boletoFilePath = uploaded.filePath;
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Erro desconhecido.";
      return NextResponse.json<PaymentCreateResponse>(
        { success: false, error: "Falha ao enviar arquivo do boleto.", detail },
        { status: 500 }
      );
    }
  }

  const resolvedMethod = resolvePaymentMethodForCreate(
    paymentMethod,
    pixCode,
    boletoFilePath,
    boletoUrl,
    digitableLine,
  );
  if (!resolvedMethod) {
    if (boletoFilePath) await deletePortalFile(boletoFilePath).catch(() => {});
    return NextResponse.json<PaymentCreateResponse>(
      {
        success: false,
        error: "Método de pagamento obrigatório.",
        detail: "Informe o método ou forneça dados de PIX, boleto ou linha digitável.",
      },
      { status: 400 }
    );
  }

  try {
    const payment = await createPayment({
      clientId,
      title,
      description,
      referenceMonth,
      amount,
      dueDate,
      status,
      paymentMethod: resolvedMethod,
      boletoUrl,
      digitableLine,
      pixCode,
      boletoFilePath,
    });
    return NextResponse.json<PaymentCreateResponse>(
      { success: true, payment },
      { status: 201 }
    );
  } catch (err) {
    if (boletoFilePath) await deletePortalFile(boletoFilePath).catch(() => {});
    const detail = err instanceof Error ? err.message : "Erro desconhecido.";
    return NextResponse.json<PaymentCreateResponse>(
      { success: false, error: "Erro ao salvar pagamento.", detail },
      { status: 500 }
    );
  }
}

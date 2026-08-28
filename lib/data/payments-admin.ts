import "server-only";
import { createAdminClient as mkAdmin } from "@/lib/supabase/admin";

// ── Types ──────────────────────────────────────────────────────────────────────

export type PaymentStatus = "pending" | "paid" | "overdue" | "cancelled" | "failed";

export interface AdminPaymentRow {
  id: string;
  clientId: string;
  title: string;
  description: string | null;
  referenceMonth: string | null;
  amount: number;
  currency: string;
  dueDate: string;
  paidAt: string | null;
  status: PaymentStatus;
  paymentMethod: string | null;
  boletoFilePath: string | null;
  boletoUrl: string | null;
  barcode: string | null;
  digitableLine: string | null;
  pixCode: string | null;
  receiptFilePath: string | null;
  receiptUrl: string | null;
  createdAt: string;
}

export interface PaymentCreateInput {
  clientId: string;
  title: string;
  description?: string | null;
  referenceMonth?: string | null;
  amount: number;
  currency?: string;
  dueDate: string;
  status?: PaymentStatus;
  paymentMethod?: string | null;
  boletoFilePath?: string | null;
  boletoUrl?: string | null;
  barcode?: string | null;
  digitableLine?: string | null;
  pixCode?: string | null;
}

export interface PaymentUpdateInput {
  title?: string;
  description?: string | null;
  referenceMonth?: string | null;
  amount?: number;
  dueDate?: string;
  status?: PaymentStatus;
  paymentMethod?: string | null;
  boletoUrl?: string | null;
  digitableLine?: string | null;
  pixCode?: string | null;
  paidAt?: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const COLS =
  "id, client_id, title, description, reference_month, amount, currency, due_date, paid_at, status, payment_method, boleto_file_path, boleto_url, barcode, digitable_line, pix_code, receipt_file_path, receipt_url, created_at";

function coerceStatus(raw: unknown): PaymentStatus {
  if (
    raw === "paid" ||
    raw === "overdue" ||
    raw === "cancelled" ||
    raw === "failed"
  )
    return raw;
  return "pending";
}

function coerceRow(r: Record<string, unknown>): AdminPaymentRow {
  return {
    id:              String(r.id ?? ""),
    clientId:        String(r.client_id ?? ""),
    title:           String(r.title ?? ""),
    description:     r.description      ? String(r.description)      : null,
    referenceMonth:  r.reference_month  ? String(r.reference_month)  : null,
    amount:          Number(r.amount)   || 0,
    currency:        String(r.currency  ?? "BRL"),
    dueDate:         String(r.due_date  ?? ""),
    paidAt:          r.paid_at          ? String(r.paid_at)          : null,
    status:          coerceStatus(r.status),
    paymentMethod:   r.payment_method   ? String(r.payment_method)   : null,
    boletoFilePath:  r.boleto_file_path ? String(r.boleto_file_path) : null,
    boletoUrl:       r.boleto_url       ? String(r.boleto_url)       : null,
    barcode:         r.barcode          ? String(r.barcode)          : null,
    digitableLine:   r.digitable_line   ? String(r.digitable_line)   : null,
    pixCode:         r.pix_code         ? String(r.pix_code)         : null,
    receiptFilePath: r.receipt_file_path ? String(r.receipt_file_path) : null,
    receiptUrl:      r.receipt_url      ? String(r.receipt_url)      : null,
    createdAt:       String(r.created_at ?? ""),
  };
}

// ── Queries ────────────────────────────────────────────────────────────────────

export async function listPaymentsByClient(
  clientId: string
): Promise<AdminPaymentRow[]> {
  const admin = mkAdmin();
  const { data, error } = await admin
    .from("payments")
    .select(COLS)
    .eq("client_id", clientId)
    .order("due_date", { ascending: true });

  if (error) {
    console.error("[listPaymentsByClient]", error.message);
    throw new Error(error.message);
  }
  return (data ?? []).map((r) => coerceRow(r as Record<string, unknown>));
}

export async function getPaymentById(
  id: string
): Promise<AdminPaymentRow | null> {
  const admin = mkAdmin();
  const { data, error } = await admin
    .from("payments")
    .select(COLS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[getPaymentById]", error.message);
    throw new Error(error.message);
  }
  return data ? coerceRow(data as Record<string, unknown>) : null;
}

export async function createPayment(
  input: PaymentCreateInput
): Promise<AdminPaymentRow> {
  const admin = mkAdmin();
  const row = {
    client_id:       input.clientId,
    title:           input.title,
    description:     input.description     ?? null,
    reference_month: input.referenceMonth  ?? null,
    amount:          input.amount,
    currency:        input.currency        ?? "BRL",
    due_date:        input.dueDate,
    status:          input.status          ?? "pending",
    payment_method:  input.paymentMethod   ?? null,
    boleto_file_path: input.boletoFilePath ?? null,
    boleto_url:      input.boletoUrl       ?? null,
    barcode:         input.barcode         ?? null,
    digitable_line:  input.digitableLine   ?? null,
    pix_code:        input.pixCode         ?? null,
  };

  const { data, error } = await admin
    .from("payments")
    .insert(row)
    .select(COLS)
    .single();

  if (error) {
    console.error("[createPayment]", error.code, error.message);
    throw new Error(error.message);
  }
  return coerceRow(data as Record<string, unknown>);
}

export async function updatePayment(
  id: string,
  patch: PaymentUpdateInput
): Promise<AdminPaymentRow> {
  const admin = mkAdmin();
  const updateData: Record<string, unknown> = {};

  if (patch.title !== undefined)         updateData.title           = patch.title;
  if ("description"    in patch)         updateData.description     = patch.description    ?? null;
  if ("referenceMonth" in patch)         updateData.reference_month = patch.referenceMonth ?? null;
  if (patch.amount     !== undefined)    updateData.amount          = patch.amount;
  if (patch.dueDate    !== undefined)    updateData.due_date        = patch.dueDate;
  if (patch.status     !== undefined)    updateData.status          = patch.status;
  if ("paymentMethod"  in patch)         updateData.payment_method  = patch.paymentMethod  ?? null;
  if ("boletoUrl"      in patch)         updateData.boleto_url      = patch.boletoUrl      ?? null;
  if ("digitableLine"  in patch)         updateData.digitable_line  = patch.digitableLine  ?? null;
  if ("pixCode"        in patch)         updateData.pix_code        = patch.pixCode        ?? null;
  if ("paidAt"         in patch)         updateData.paid_at         = patch.paidAt         ?? null;

  const { data, error } = await admin
    .from("payments")
    .update(updateData)
    .eq("id", id)
    .select(COLS)
    .single();

  if (error) {
    console.error("[updatePayment]", error.code, error.message);
    throw new Error(error.message);
  }
  return coerceRow(data as Record<string, unknown>);
}

export async function markPaymentAsPaid(
  id: string
): Promise<AdminPaymentRow> {
  return updatePayment(id, {
    status: "paid",
    paidAt: new Date().toISOString(),
  });
}

export async function deletePayment(id: string): Promise<void> {
  const admin = mkAdmin();
  const { error } = await admin.from("payments").delete().eq("id", id);
  if (error) {
    console.error("[deletePayment]", error.code, error.message);
    throw new Error(error.message);
  }
}

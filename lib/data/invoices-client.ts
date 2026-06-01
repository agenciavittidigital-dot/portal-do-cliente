import "server-only";
import { createAdminClient as mkAdmin } from "@/lib/supabase/admin";
import type { InvoiceStatus } from "./invoices-admin";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ClientInvoiceRow {
  id: string;
  title: string;
  description: string | null;
  referenceMonth: string | null;
  amount: number | null;
  invoiceNumber: string | null;
  issuedAt: string | null;
  filePath: string;
  fileName: string | null;
  fileSize: number | null;
  createdAt: string;
  status: InvoiceStatus;
}

// ── resolveClientForUser ───────────────────────────────────────────────────────

export async function resolveClientForUser(authUserId: string): Promise<string | null> {
  const admin = mkAdmin();

  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (!profile?.id) return null;

  const { data: clientUser } = await admin
    .from("client_users")
    .select("client_id")
    .eq("profile_id", String(profile.id))
    .maybeSingle();

  return clientUser?.client_id ? String(clientUser.client_id) : null;
}

// ── Payments ──────────────────────────────────────────────────────────────────

export type PaymentStatus = "pending" | "paid" | "cancelled" | "overdue" | "failed";

export interface ClientPaymentRow {
  id: string;
  title: string;
  description: string | null;
  referenceMonth: string | null;
  amount: number;
  currency: string;
  dueDate: string;
  paidAt: string | null;
  status: PaymentStatus;
  paymentMethod: string;
  boletoFilePath: string | null;
  boletoUrl: string | null;
  barcode: string | null;
  digitableLine: string | null;
  pixCode: string | null;
  receiptFilePath: string | null;
  receiptUrl: string | null;
  createdAt: string;
}

function coercePaymentStatus(raw: unknown): PaymentStatus {
  if (raw === "paid" || raw === "cancelled" || raw === "overdue" || raw === "failed") return raw;
  return "pending";
}

export async function listClientPayments(clientId: string): Promise<ClientPaymentRow[]> {
  const admin = mkAdmin();
  const { data, error } = await admin
    .from("payments")
    .select(
      "id, title, description, reference_month, amount, currency, due_date, paid_at, status, payment_method, boleto_file_path, boleto_url, barcode, digitable_line, pix_code, receipt_file_path, receipt_url, created_at"
    )
    .eq("client_id", clientId)
    .order("due_date", { ascending: true });

  if (error) {
    console.error("[listClientPayments] Erro:", error.message);
    return [];
  }

  return (data ?? []).map((r: Record<string, unknown>) => ({
    id:              String(r.id ?? ""),
    title:           String(r.title ?? ""),
    description:     r.description     ? String(r.description)     : null,
    referenceMonth:  r.reference_month ? String(r.reference_month) : null,
    amount:          Number(r.amount)  || 0,
    currency:        String(r.currency ?? "BRL"),
    dueDate:         String(r.due_date ?? ""),
    paidAt:          r.paid_at         ? String(r.paid_at)          : null,
    status:          coercePaymentStatus(r.status),
    paymentMethod:   String(r.payment_method ?? ""),
    boletoFilePath:  r.boleto_file_path  ? String(r.boleto_file_path)  : null,
    boletoUrl:       r.boleto_url        ? String(r.boleto_url)        : null,
    barcode:         r.barcode           ? String(r.barcode)           : null,
    digitableLine:   r.digitable_line    ? String(r.digitable_line)    : null,
    pixCode:         r.pix_code          ? String(r.pix_code)          : null,
    receiptFilePath: r.receipt_file_path ? String(r.receipt_file_path) : null,
    receiptUrl:      r.receipt_url       ? String(r.receipt_url)       : null,
    createdAt:       String(r.created_at ?? ""),
  }));
}

// ── listClientInvoices ─────────────────────────────────────────────────────────

export async function listClientInvoices(clientId: string): Promise<ClientInvoiceRow[]> {
  const admin = mkAdmin();
  const { data, error } = await admin
    .from("invoices")
    .select(
      "id, title, description, reference_month, amount, invoice_number, issued_at, file_path, file_name, file_size, status, created_at"
    )
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[listClientInvoices] Erro:", error.message);
    return [];
  }

  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: String(r.id ?? ""),
    title: String(r.title ?? ""),
    description: r.description ? String(r.description) : null,
    referenceMonth: r.reference_month ? String(r.reference_month) : null,
    amount: r.amount != null ? Number(r.amount) : null,
    invoiceNumber: r.invoice_number ? String(r.invoice_number) : null,
    issuedAt: r.issued_at ? String(r.issued_at) : null,
    filePath: String(r.file_path ?? ""),
    fileName: r.file_name ? String(r.file_name) : null,
    fileSize: r.file_size != null ? Number(r.file_size) : null,
    createdAt: String(r.created_at ?? ""),
    status:
      r.status === "pending" || r.status === "cancelled"
        ? (r.status as InvoiceStatus)
        : "issued",
  }));
}

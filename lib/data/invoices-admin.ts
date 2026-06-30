import "server-only";
import { createAdminClient as mkAdmin } from "@/lib/supabase/admin";

// ── Types ──────────────────────────────────────────────────────────────────────

export type InvoiceStatus = "issued" | "pending" | "cancelled";

export interface AdminInvoiceRow {
  id: string;
  clientId: string;
  title: string;
  description: string | null;
  referenceMonth: string | null;
  amount: number | null;
  invoiceNumber: string | null;
  issuedAt: string | null;
  filePath: string;
  fileName: string | null;
  fileType: string;
  fileSize: number | null;
  status: InvoiceStatus;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceCreateInput {
  clientId: string;
  title: string;
  description?: string | null;
  referenceMonth?: string | null;
  amount?: number | null;
  invoiceNumber?: string | null;
  issuedAt?: string | null;
  filePath: string;
  fileName?: string | null;
  fileType: string;
  fileSize?: number | null;
  status?: InvoiceStatus;
}

export interface InvoiceUpdateInput {
  title?: string;
  description?: string | null;
  referenceMonth?: string | null;
  amount?: number | null;
  invoiceNumber?: string | null;
  issuedAt?: string | null;
  status?: InvoiceStatus;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const COLS =
  "id, client_id, title, description, reference_month, amount, invoice_number, issued_at, file_path, file_name, file_type, file_size, status, created_at, updated_at";

function coerceStatus(raw: unknown): InvoiceStatus {
  if (raw === "pending" || raw === "cancelled") return raw;
  return "issued";
}

function coerceRow(r: Record<string, unknown>): AdminInvoiceRow {
  return {
    id: String(r.id ?? ""),
    clientId: String(r.client_id ?? ""),
    title: String(r.title ?? ""),
    description: r.description ? String(r.description) : null,
    referenceMonth: r.reference_month ? String(r.reference_month) : null,
    amount: r.amount != null ? Number(r.amount) : null,
    invoiceNumber: r.invoice_number ? String(r.invoice_number) : null,
    issuedAt: r.issued_at ? String(r.issued_at) : null,
    filePath: String(r.file_path ?? ""),
    fileName: r.file_name ? String(r.file_name) : null,
    fileType: String(r.file_type ?? "application/octet-stream"),
    fileSize: r.file_size != null ? Number(r.file_size) : null,
    status: coerceStatus(r.status),
    createdAt: String(r.created_at ?? ""),
    updatedAt: String(r.updated_at ?? ""),
  };
}

// ── Queries ────────────────────────────────────────────────────────────────────

export async function listInvoicesByClient(clientId: string): Promise<AdminInvoiceRow[]> {
  const admin = mkAdmin();
  const { data, error } = await admin
    .from("invoices")
    .select(COLS)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[listInvoicesByClient] Erro:", error.message);
    throw new Error(error.message);
  }
  return (data ?? []).map((r) => coerceRow(r as Record<string, unknown>));
}

export async function getInvoiceById(id: string): Promise<AdminInvoiceRow | null> {
  const admin = mkAdmin();
  const { data, error } = await admin
    .from("invoices")
    .select(COLS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[getInvoiceById] Erro:", error.message);
    throw new Error(error.message);
  }
  return data ? coerceRow(data as Record<string, unknown>) : null;
}

export async function createInvoice(input: InvoiceCreateInput): Promise<AdminInvoiceRow> {
  const admin = mkAdmin();

  const row = {
    client_id: input.clientId,
    title: input.title,
    description: input.description ?? null,
    reference_month: input.referenceMonth ?? null,
    amount: input.amount ?? null,
    invoice_number: input.invoiceNumber ?? null,
    issued_at: input.issuedAt ?? null,
    file_path: input.filePath,
    file_name: input.fileName ?? null,
    file_type: input.fileType,
    file_size: input.fileSize ?? null,
    status: input.status ?? "issued",
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await admin
    .from("invoices")
    .insert(row)
    .select(COLS)
    .single();

  if (error) {
    console.error("[createInvoice] Supabase error:", error.code, error.message, error.hint ?? "");
    throw new Error(error.message);
  }
  return coerceRow(data as Record<string, unknown>);
}

export async function updateInvoice(
  id: string,
  patch: InvoiceUpdateInput
): Promise<AdminInvoiceRow> {
  const admin = mkAdmin();

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.title !== undefined) updateData.title = patch.title;
  if ("description" in patch) updateData.description = patch.description || null;
  if ("referenceMonth" in patch) updateData.reference_month = patch.referenceMonth || null;
  if ("amount" in patch) updateData.amount = patch.amount ?? null;
  if ("invoiceNumber" in patch) updateData.invoice_number = patch.invoiceNumber || null;
  if ("issuedAt" in patch) updateData.issued_at = patch.issuedAt || null;
  if (patch.status !== undefined) updateData.status = patch.status;

  const { data, error } = await admin
    .from("invoices")
    .update(updateData)
    .eq("id", id)
    .select(COLS)
    .single();

  if (error) {
    console.error("[updateInvoice] Supabase error:", error.code, error.message, error.hint ?? "");
    throw new Error(error.message);
  }
  return coerceRow(data as Record<string, unknown>);
}

export async function deleteInvoice(id: string): Promise<void> {
  const admin = mkAdmin();
  const { error } = await admin.from("invoices").delete().eq("id", id);
  if (error) {
    console.error("[deleteInvoice] Supabase error:", error.code, error.message);
    throw new Error(error.message);
  }
}

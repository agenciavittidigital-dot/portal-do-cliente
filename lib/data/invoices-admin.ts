import "server-only";
import { createAdminClient as mkAdmin } from "@/lib/supabase/admin";

// ── Types ──────────────────────────────────────────────────────────────────────

export type InvoiceStatus = "emitida" | "pendente" | "cancelada";

export interface AdminInvoiceRow {
  id: string;
  clientId: string;
  title: string;
  competence: string;
  issuedAt: string | null;
  status: InvoiceStatus;
  amount: number | null;
  nfUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceCreateInput {
  clientId: string;
  title: string;
  competence: string;
  issuedAt?: string | null;
  status?: InvoiceStatus;
  amount?: number | null;
  nfUrl?: string | null;
  notes?: string | null;
}

export interface InvoiceUpdateInput {
  title?: string;
  competence?: string;
  issuedAt?: string | null;
  status?: InvoiceStatus;
  amount?: number | null;
  nfUrl?: string | null;
  notes?: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const COLS =
  "id, client_id, title, competence, issued_at, status, amount, nf_url, notes, created_at, updated_at";

function coerceStatus(raw: unknown): InvoiceStatus {
  if (raw === "pendente" || raw === "cancelada") return raw;
  return "emitida";
}

function coerceRow(r: Record<string, unknown>): AdminInvoiceRow {
  return {
    id: String(r.id ?? ""),
    clientId: String(r.client_id ?? ""),
    title: String(r.title ?? ""),
    competence: String(r.competence ?? ""),
    issuedAt: r.issued_at ? String(r.issued_at) : null,
    status: coerceStatus(r.status),
    amount: r.amount != null ? Number(r.amount) : null,
    nfUrl: r.nf_url ? String(r.nf_url) : null,
    notes: r.notes ? String(r.notes) : null,
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
    return [];
  }
  return (data ?? []).map((r) => coerceRow(r as Record<string, unknown>));
}

export async function createInvoice(input: InvoiceCreateInput): Promise<AdminInvoiceRow> {
  const admin = mkAdmin();

  const row: Record<string, unknown> = {
    client_id: input.clientId,
    title: input.title,
    competence: input.competence,
    status: input.status ?? "emitida",
  };
  if (input.issuedAt) row.issued_at = input.issuedAt;
  if (input.amount != null) row.amount = input.amount;
  if (input.nfUrl) row.nf_url = input.nfUrl;
  if (input.notes) row.notes = input.notes;

  const { data, error } = await admin
    .from("invoices")
    .insert(row)
    .select(COLS)
    .single();

  if (error) throw new Error(error.message);
  return coerceRow(data as Record<string, unknown>);
}

export async function updateInvoice(id: string, patch: InvoiceUpdateInput): Promise<AdminInvoiceRow> {
  const admin = mkAdmin();

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.title !== undefined) updateData.title = patch.title;
  if (patch.competence !== undefined) updateData.competence = patch.competence;
  if ("issuedAt" in patch) updateData.issued_at = patch.issuedAt || null;
  if (patch.status !== undefined) updateData.status = patch.status;
  if ("amount" in patch) updateData.amount = patch.amount;
  if ("nfUrl" in patch) updateData.nf_url = patch.nfUrl || null;
  if ("notes" in patch) updateData.notes = patch.notes || null;

  const { data, error } = await admin
    .from("invoices")
    .update(updateData)
    .eq("id", id)
    .select(COLS)
    .single();

  if (error) throw new Error(error.message);
  return coerceRow(data as Record<string, unknown>);
}

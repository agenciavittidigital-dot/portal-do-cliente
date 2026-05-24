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

// ── listClientInvoices ─────────────────────────────────────────────────────────

export async function listClientInvoices(clientId: string): Promise<ClientInvoiceRow[]> {
  const admin = mkAdmin();
  const { data, error } = await admin
    .from("invoices")
    .select(
      "id, title, description, reference_month, amount, invoice_number, issued_at, file_path, file_name, status"
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
    status:
      r.status === "pending" || r.status === "cancelled"
        ? (r.status as InvoiceStatus)
        : "issued",
  }));
}

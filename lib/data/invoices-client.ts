import "server-only";
import { createAdminClient as mkAdmin } from "@/lib/supabase/admin";
import type { InvoiceStatus } from "./invoices-admin";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ClientInvoiceRow {
  id: string;
  title: string;
  competence: string;
  issuedAt: string | null;
  status: InvoiceStatus;
  amount: number | null;
  nfUrl: string | null;
  notes: string | null;
}

// ── resolveClientForUser ───────────────────────────────────────────────────────
// Lookup direto usando profile_id (schema real de client_users)

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
    .select("id, title, competence, issued_at, status, amount, nf_url, notes")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[listClientInvoices] Erro:", error.message);
    return [];
  }

  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: String(r.id ?? ""),
    title: String(r.title ?? ""),
    competence: String(r.competence ?? ""),
    issuedAt: r.issued_at ? String(r.issued_at) : null,
    status:
      r.status === "pendente" || r.status === "cancelada" ? r.status : "emitida",
    amount: r.amount != null ? Number(r.amount) : null,
    nfUrl: r.nf_url ? String(r.nf_url) : null,
    notes: r.notes ? String(r.notes) : null,
  }));
}

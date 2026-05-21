import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { updateInvoice } from "@/lib/data/invoices-admin";
import type { AdminInvoiceRow, InvoiceStatus } from "@/lib/data/invoices-admin";

export interface InvoicePatchResponse {
  success: boolean;
  invoice?: AdminInvoiceRow;
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
      error: NextResponse.json<InvoicePatchResponse>(
        { success: false, error: "Não autenticado." },
        { status: 401 }
      ),
    };
  }
  const ctx = await loadUserContext(user.id);
  if (!ctx.isAdmin) {
    return {
      error: NextResponse.json<InvoicePatchResponse>(
        { success: false, error: "Acesso restrito a administradores Vitti." },
        { status: 403 }
      ),
    };
  }
  return { userId: user.id };
}

const VALID_STATUSES: InvoiceStatus[] = ["emitida", "pendente", "cancelada"];

// PATCH /api/admin/finance/invoices/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  if (!id) {
    return NextResponse.json<InvoicePatchResponse>(
      { success: false, error: "ID inválido." },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<InvoicePatchResponse>(
      { success: false, error: "Body inválido." },
      { status: 400 }
    );
  }

  const b = body as Record<string, unknown>;
  const patch: Parameters<typeof updateInvoice>[1] = {};

  if (typeof b.title === "string" && b.title.trim()) patch.title = b.title.trim();
  if (typeof b.competence === "string" && b.competence.trim()) patch.competence = b.competence.trim();
  if ("issuedAt" in b) patch.issuedAt = typeof b.issuedAt === "string" && b.issuedAt ? b.issuedAt : null;
  if (typeof b.status === "string" && VALID_STATUSES.includes(b.status as InvoiceStatus)) {
    patch.status = b.status as InvoiceStatus;
  }
  if ("amount" in b) patch.amount = typeof b.amount === "number" && !isNaN(b.amount) ? b.amount : null;
  if ("nfUrl" in b) patch.nfUrl = typeof b.nfUrl === "string" && b.nfUrl.trim() ? b.nfUrl.trim() : null;
  if ("notes" in b) patch.notes = typeof b.notes === "string" && b.notes.trim() ? b.notes.trim() : null;

  try {
    const invoice = await updateInvoice(id, patch);
    return NextResponse.json<InvoicePatchResponse>({ success: true, invoice });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Erro desconhecido.";
    return NextResponse.json<InvoicePatchResponse>(
      { success: false, error: "Erro ao atualizar nota fiscal.", detail },
      { status: 500 }
    );
  }
}

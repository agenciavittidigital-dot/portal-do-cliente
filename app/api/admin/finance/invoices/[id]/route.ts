import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { updateInvoice, getInvoiceById, deleteInvoice } from "@/lib/data/invoices-admin";
import type { AdminInvoiceRow, InvoiceStatus } from "@/lib/data/invoices-admin";
import { deletePortalFile } from "@/lib/storage/portal-files";

export interface InvoicePatchResponse {
  success: boolean;
  invoice?: AdminInvoiceRow;
  error?: string;
  detail?: string;
}

export interface InvoiceDeleteResponse {
  success: boolean;
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

const VALID_STATUSES: InvoiceStatus[] = ["issued", "pending", "cancelled"];

// PATCH /api/admin/finance/invoices/[id] — metadata only
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
  if ("amount" in b) {
    patch.amount =
      typeof b.amount === "number" && !isNaN(b.amount) ? b.amount : null;
  }
  if ("invoiceNumber" in b) {
    patch.invoiceNumber =
      typeof b.invoiceNumber === "string" && b.invoiceNumber.trim()
        ? b.invoiceNumber.trim()
        : null;
  }
  if ("issuedAt" in b) {
    patch.issuedAt =
      typeof b.issuedAt === "string" && b.issuedAt.trim() ? b.issuedAt.trim() : null;
  }
  if (typeof b.status === "string" && VALID_STATUSES.includes(b.status as InvoiceStatus)) {
    patch.status = b.status as InvoiceStatus;
  }

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

// DELETE /api/admin/finance/invoices/[id] — remove NF and storage file
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  if (!id) {
    return NextResponse.json<InvoiceDeleteResponse>(
      { success: false, error: "ID inválido." },
      { status: 400 }
    );
  }

  try {
    const invoice = await getInvoiceById(id);
    if (!invoice) {
      return NextResponse.json<InvoiceDeleteResponse>(
        { success: false, error: "NF não encontrada." },
        { status: 404 }
      );
    }

    await deleteInvoice(id);

    try {
      await deletePortalFile(invoice.filePath);
    } catch (storageErr) {
      console.error("[DELETE invoice] Storage cleanup failed:", storageErr);
    }

    return NextResponse.json<InvoiceDeleteResponse>({ success: true });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Erro desconhecido.";
    return NextResponse.json<InvoiceDeleteResponse>(
      { success: false, error: "Erro ao excluir nota fiscal.", detail },
      { status: 500 }
    );
  }
}

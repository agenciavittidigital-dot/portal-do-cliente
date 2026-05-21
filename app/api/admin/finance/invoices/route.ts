import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import {
  listInvoicesByClient,
  createInvoice,
} from "@/lib/data/invoices-admin";
import type { AdminInvoiceRow, InvoiceStatus } from "@/lib/data/invoices-admin";

export interface InvoiceListResponse {
  success: boolean;
  invoices?: AdminInvoiceRow[];
  error?: string;
}

export interface InvoiceCreateResponse {
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
      error: NextResponse.json<InvoiceListResponse>(
        { success: false, error: "Não autenticado." },
        { status: 401 }
      ),
    };
  }
  const ctx = await loadUserContext(user.id);
  if (!ctx.isAdmin) {
    return {
      error: NextResponse.json<InvoiceListResponse>(
        { success: false, error: "Acesso restrito a administradores Vitti." },
        { status: 403 }
      ),
    };
  }
  return { userId: user.id };
}

const VALID_STATUSES: InvoiceStatus[] = ["emitida", "pendente", "cancelada"];

// GET /api/admin/finance/invoices?clientId=...
export async function GET(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const clientId = new URL(req.url).searchParams.get("clientId");
  if (!clientId) {
    return NextResponse.json<InvoiceListResponse>(
      { success: false, error: "clientId é obrigatório." },
      { status: 400 }
    );
  }

  const invoices = await listInvoicesByClient(clientId);
  return NextResponse.json<InvoiceListResponse>({ success: true, invoices });
}

// POST /api/admin/finance/invoices
export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<InvoiceCreateResponse>(
      { success: false, error: "Body inválido." },
      { status: 400 }
    );
  }

  const b = body as Record<string, unknown>;

  if (!b.clientId || typeof b.clientId !== "string") {
    return NextResponse.json<InvoiceCreateResponse>(
      { success: false, error: "clientId é obrigatório." },
      { status: 400 }
    );
  }
  if (!b.title || typeof b.title !== "string" || !b.title.trim()) {
    return NextResponse.json<InvoiceCreateResponse>(
      { success: false, error: "title é obrigatório." },
      { status: 400 }
    );
  }
  if (!b.competence || typeof b.competence !== "string" || !b.competence.trim()) {
    return NextResponse.json<InvoiceCreateResponse>(
      { success: false, error: "competence é obrigatório." },
      { status: 400 }
    );
  }

  const status: InvoiceStatus =
    typeof b.status === "string" && VALID_STATUSES.includes(b.status as InvoiceStatus)
      ? (b.status as InvoiceStatus)
      : "emitida";

  try {
    const invoice = await createInvoice({
      clientId: b.clientId,
      title: String(b.title).trim(),
      competence: String(b.competence).trim(),
      issuedAt: typeof b.issuedAt === "string" && b.issuedAt ? b.issuedAt : null,
      status,
      amount: typeof b.amount === "number" && !isNaN(b.amount) ? b.amount : null,
      nfUrl: typeof b.nfUrl === "string" && b.nfUrl.trim() ? b.nfUrl.trim() : null,
      notes: typeof b.notes === "string" && b.notes.trim() ? b.notes.trim() : null,
    });
    return NextResponse.json<InvoiceCreateResponse>({ success: true, invoice });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Erro desconhecido.";
    return NextResponse.json<InvoiceCreateResponse>(
      { success: false, error: "Erro ao criar nota fiscal.", detail },
      { status: 500 }
    );
  }
}

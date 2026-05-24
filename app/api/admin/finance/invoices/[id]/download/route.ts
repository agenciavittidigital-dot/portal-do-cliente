import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { getInvoiceById } from "@/lib/data/invoices-admin";
import { getSignedDownloadUrl } from "@/lib/storage/portal-files";

async function requireAdmin(): Promise<{ userId: string } | { error: Response }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error: NextResponse.json({ success: false, error: "Não autenticado." }, { status: 401 }),
    };
  }
  const ctx = await loadUserContext(user.id);
  if (!ctx.isAdmin) {
    return {
      error: NextResponse.json(
        { success: false, error: "Acesso restrito a administradores Vitti." },
        { status: 403 }
      ),
    };
  }
  return { userId: user.id };
}

// GET /api/admin/finance/invoices/[id]/download
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;

  try {
    const invoice = await getInvoiceById(id);
    if (!invoice) {
      return NextResponse.json({ success: false, error: "Nota fiscal não encontrada." }, { status: 404 });
    }
    const signedUrl = await getSignedDownloadUrl(invoice.filePath, 3600);
    return NextResponse.redirect(signedUrl);
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Erro desconhecido.";
    return NextResponse.json({ success: false, error: "Erro ao gerar link.", detail }, { status: 500 });
  }
}

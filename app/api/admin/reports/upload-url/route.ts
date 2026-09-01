import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadUserContext } from "@/lib/data/user-context";
import { getSignedUploadUrl } from "@/lib/storage/portal-files";

const ALLOWED_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
};

interface UploadUrlBody {
  clientId: string;
  fileName: string;
  fileType: string;
}

export interface UploadUrlResponse {
  success: boolean;
  uploadUrl?: string;
  filePath?: string;
  error?: string;
}

function err(message: string, status: number) {
  return NextResponse.json<UploadUrlResponse>({ success: false, error: message }, { status });
}

// POST /api/admin/reports/upload-url
// Returns a short-lived signed URL for direct browser upload to Supabase Storage.
// No file bytes pass through this route.
export async function POST(req: NextRequest): Promise<Response> {
  // ── Autenticação ──────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("Não autenticado.", 401);

  // ── Autorização ───────────────────────────────────────────────
  const ctx = await loadUserContext(user.id);
  if (!ctx.isAdmin) return err("Acesso restrito a administradores Vitti.", 403);

  // ── Body ──────────────────────────────────────────────────────
  let body: UploadUrlBody;
  try {
    body = await req.json();
  } catch {
    return err("Body inválido — JSON esperado.", 400);
  }

  const { clientId, fileType } = body;

  if (!clientId || typeof clientId !== "string" || !clientId.trim()) {
    return err("clientId é obrigatório.", 400);
  }

  if (!fileType || !ALLOWED_TYPES[fileType]) {
    return err("Tipo de arquivo não permitido. Use PDF, PNG ou JPEG.", 400);
  }

  // ── Verifica se o cliente existe ──────────────────────────────
  const admin = createAdminClient();
  const { data: clientRow, error: clientError } = await admin
    .from("clients")
    .select("id")
    .eq("id", clientId.trim())
    .maybeSingle();

  if (clientError) {
    console.error("[upload-url] Erro ao verificar cliente:", clientError.message);
    return err("Erro ao verificar cliente.", 500);
  }
  if (!clientRow) {
    return err("Cliente não encontrado.", 404);
  }

  // ── Gera filePath único e seguro ──────────────────────────────
  const ext = ALLOWED_TYPES[fileType];
  const filePath = `clients/${clientId.trim()}/reports/${Date.now()}-${randomUUID()}.${ext}`;

  // ── Gera Signed Upload URL ────────────────────────────────────
  try {
    const { signedUrl } = await getSignedUploadUrl(filePath);
    return NextResponse.json<UploadUrlResponse>({
      success: true,
      uploadUrl: signedUrl,
      filePath,
    });
  } catch (e) {
    console.error("[upload-url] Erro ao gerar signed URL:", e instanceof Error ? e.message : e);
    return err("Falha ao preparar o upload. Tente novamente.", 500);
  }
}

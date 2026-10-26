import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { saveMetaIntegration } from "@/lib/data/meta-integrations";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MetaSaveApiResponse {
  success: boolean;
  integrationId?: string;
  error?: string;
  detail?: string;
}

interface SaveBody {
  clientId: string;
  accountId: string;
  accountName: string;
  token: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function err(message: string, status: number, detail?: string) {
  return NextResponse.json<MetaSaveApiResponse>(
    { success: false, error: message, ...(detail ? { detail } : {}) },
    { status }
  );
}

function normalizeAccountId(raw: string): string | null {
  const cleaned = raw.trim().replace(/^act_/i, "");
  if (!/^\d{5,20}$/.test(cleaned)) return null;
  return cleaned;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Autenticação
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err("Não autenticado.", 401);

  // Autorização
  const ctx = await loadUserContext(user.id);
  if (!ctx.isAdmin) return err("Acesso restrito a administradores Vitti.", 403);

  // Body
  let body: SaveBody;
  try {
    body = await request.json();
  } catch {
    return err("Body inválido — JSON esperado.", 400);
  }

  const { clientId, accountName, token } = body;
  const rawAccountId = body.accountId;

  if (!clientId || typeof clientId !== "string" || !clientId.trim()) {
    return err("clientId é obrigatório.", 400);
  }
  if (!rawAccountId || typeof rawAccountId !== "string") {
    return err("accountId é obrigatório.", 400);
  }
  if (!accountName || typeof accountName !== "string" || !accountName.trim()) {
    return err("accountName é obrigatório.", 400);
  }
  if (!token || typeof token !== "string" || !token.trim()) {
    return err("token é obrigatório.", 400);
  }

  const accountId = normalizeAccountId(rawAccountId);
  if (!accountId) {
    return err(
      "accountId inválido. Informe apenas dígitos ou no formato act_XXXXXXXX.",
      400
    );
  }

  // Salva — criptografia acontece dentro de saveMetaIntegration
  const result = await saveMetaIntegration({
    clientId: clientId.trim(),
    accountId,
    accountName: accountName.trim(),
    accessToken: token.trim(),
  });

  if ("error" in result) {
    return err(result.error, 500, result.detail);
  }

  return NextResponse.json<MetaSaveApiResponse>({
    success: true,
    integrationId: result.id,
  });
}

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { createMetaClient } from "@/lib/integrations/meta/client";
import type { MetaAccountInfo } from "@/lib/integrations/meta/types";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MetaValidateApiResponse {
  success: boolean;
  account?: MetaAccountInfo;
  error?: string;
  errorCode?: number | null;
  errorSubcode?: number | null;
}

interface ValidateBody {
  accountId: string;
  token: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function err(message: string, status: number, extra?: Partial<MetaValidateApiResponse>) {
  return NextResponse.json<MetaValidateApiResponse>(
    { success: false, error: message, ...extra },
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
  let body: ValidateBody;
  try {
    body = await request.json();
  } catch {
    return err("Body inválido — JSON esperado.", 400);
  }

  const rawAccountId = body.accountId;
  const token = body.token;

  if (!rawAccountId || typeof rawAccountId !== "string") {
    return err("accountId é obrigatório.", 400);
  }
  if (!token || typeof token !== "string" || !token.trim()) {
    return err("token é obrigatório.", 400);
  }

  // Normaliza account_id — aceita com ou sem prefixo act_
  const accountId = normalizeAccountId(rawAccountId);
  if (!accountId) {
    return err(
      "accountId inválido. Informe apenas dígitos ou no formato act_XXXXXXXX.",
      400
    );
  }

  // Chama Meta API — token permanece somente no servidor
  const client = createMetaClient({ accessToken: token.trim() });
  const result = await client.validateAccount(accountId);

  if (!result.ok) {
    return NextResponse.json<MetaValidateApiResponse>(
      {
        success: false,
        error: result.message,
        errorCode: result.errorCode,
        errorSubcode: result.errorSubcode,
      },
      { status: 422 }
    );
  }

  // Token não retorna na resposta — apenas metadados da conta
  return NextResponse.json<MetaValidateApiResponse>({
    success: true,
    account: result.account,
  });
}

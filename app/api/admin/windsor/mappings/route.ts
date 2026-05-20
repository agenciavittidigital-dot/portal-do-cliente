import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadUserContext } from "@/lib/data/user-context";

interface MappingBody {
  clientId: string;
  accountName: string;
  accountId?: string | null;
}

export interface MappingApiResponse {
  success: boolean;
  integrationId?: string;
  error?: string;
  detail?: string;
}

function err(message: string, status: number, detail?: string) {
  return NextResponse.json<MappingApiResponse>(
    { success: false, error: message, ...(detail ? { detail } : {}) },
    { status }
  );
}

// Gera um slug seguro derivado do account_name para usar como account_id fallback
function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 60);
}

export async function POST(request: NextRequest) {
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
  let body: MappingBody;
  try {
    body = await request.json();
  } catch {
    return err("Body inválido — JSON esperado.", 400);
  }

  const { clientId, accountName, accountId } = body;

  if (!clientId || typeof clientId !== "string" || !clientId.trim()) {
    return err("clientId é obrigatório e deve ser um UUID válido.", 400);
  }
  if (!accountName || typeof accountName !== "string" || !accountName.trim()) {
    return err("accountName é obrigatório.", 400);
  }

  const admin = createAdminClient();

  // ── Verifica se o cliente existe no portal ────────────────────
  const { data: clientRow, error: clientError } = await admin
    .from("clients")
    .select("id, name")
    .eq("id", clientId.trim())
    .maybeSingle();

  if (clientError) {
    console.error("[windsor/mappings] Erro ao buscar cliente:", clientError.message);
    return err("Erro ao verificar cliente.", 500, clientError.message);
  }
  if (!clientRow) {
    return err(
      "Cliente não encontrado.",
      404,
      `Nenhum cliente com id="${clientId.trim()}" na tabela clients.`
    );
  }

  const resolvedAccountId =
    typeof accountId === "string" && accountId.trim()
      ? accountId.trim()
      : slugify(accountName);

  const payload = {
    client_id: clientId.trim(),
    provider: "windsor",
    channel: "meta_ads",
    account_id: resolvedAccountId,
    account_name: accountName.trim(),
    status: "active",
    settings: {
      source: "windsor_all",
      matched_by: "account_name",
      raw_account_name: accountName.trim(),
      created_from: "admin_mapping_sprint_6c",
    },
  };

  // ── Verifica se já existe mapeamento para esta conta Windsor ──
  // Chave lógica: provider + channel + account_name
  // (não depende de constraint de banco — funciona mesmo sem unique index)
  const { data: existing, error: selectError } = await admin
    .from("client_integrations")
    .select("id")
    .eq("provider", "windsor")
    .eq("channel", "meta_ads")
    .eq("account_name", accountName.trim())
    .maybeSingle();

  if (selectError) {
    console.error("[windsor/mappings] Erro ao verificar mapeamento existente:", selectError.message);
    return err("Erro ao verificar mapeamento existente.", 500, selectError.message);
  }

  // ── Update se já existe, insert se não existe ─────────────────
  if (existing) {
    const { data: updated, error: updateError } = await admin
      .from("client_integrations")
      .update(payload)
      .eq("id", existing.id)
      .select("id")
      .maybeSingle();

    if (updateError) {
      console.error("[windsor/mappings] Erro no update:", updateError.message);
      return err("Falha ao atualizar mapeamento.", 500, updateError.message);
    }

    return NextResponse.json<MappingApiResponse>({
      success: true,
      integrationId: updated ? String(updated.id) : String(existing.id),
    });
  }

  const { data: inserted, error: insertError } = await admin
    .from("client_integrations")
    .insert(payload)
    .select("id")
    .maybeSingle();

  if (insertError) {
    console.error("[windsor/mappings] Erro no insert:", insertError.message);
    return err("Falha ao criar mapeamento.", 500, insertError.message);
  }

  return NextResponse.json<MappingApiResponse>({
    success: true,
    integrationId: inserted ? String(inserted.id) : undefined,
  });
}

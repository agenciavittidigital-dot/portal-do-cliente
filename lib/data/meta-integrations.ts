import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptToken, decryptToken } from "@/lib/crypto/token-cipher";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MetaIntegrationRow {
  id: string;
  client_id: string;
  account_id: string;
  account_name: string;
  token_last4: string | null;
  token_status: string | null;
  last_validated_at: string | null;
  last_sync_at: string | null;
  status: string;
  created_at: string;
}

export interface SaveMetaIntegrationInput {
  clientId: string;
  accountId: string;   // normalizado — sem prefixo act_
  accountName: string;
  accessToken: string; // plaintext — será criptografado imediatamente
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function mapRow(r: Record<string, unknown>): MetaIntegrationRow {
  return {
    id: String(r.id ?? ""),
    client_id: String(r.client_id ?? ""),
    account_id: String(r.account_id ?? ""),
    account_name: String(r.account_name ?? ""),
    token_last4: r.token_last4 ? String(r.token_last4) : null,
    token_status: r.token_status ? String(r.token_status) : null,
    last_validated_at: r.last_validated_at ? String(r.last_validated_at) : null,
    last_sync_at: r.last_sync_at ? String(r.last_sync_at) : null,
    status: String(r.status ?? ""),
    created_at: String(r.created_at ?? ""),
  };
}

// Colunas seguras — NUNCA inclui access_token_encrypted / token_iv / token_tag
const SAFE_COLUMNS =
  "id, client_id, account_id, account_name, token_last4, token_status, last_validated_at, last_sync_at, status, created_at";

// ── Queries ───────────────────────────────────────────────────────────────────

// Busca uma integração por ID — somente colunas seguras (sem token)
export async function getMetaIntegrationById(
  integrationId: string
): Promise<MetaIntegrationRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("client_integrations")
    .select(SAFE_COLUMNS)
    .eq("id", integrationId)
    .eq("provider", "meta_direct")
    .maybeSingle();
  if (error || !data) return null;
  return mapRow(data as Record<string, unknown>);
}

export async function listMetaIntegrations(
  clientId?: string
): Promise<MetaIntegrationRow[]> {
  const admin = createAdminClient();

  let q = admin
    .from("client_integrations")
    .select(SAFE_COLUMNS)
    .eq("provider", "meta_direct")
    .eq("channel", "meta_ads");

  if (clientId) q = q.eq("client_id", clientId);

  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

// Recupera o token descriptografado — uso exclusivo de sincronização server-side
export async function getMetaIntegrationToken(
  integrationId: string
): Promise<string | null> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("client_integrations")
    .select("access_token_encrypted, token_iv, token_tag")
    .eq("id", integrationId)
    .eq("provider", "meta_direct")
    .maybeSingle();

  if (error || !data) return null;

  const r = data as Record<string, unknown>;
  if (!r.access_token_encrypted || !r.token_iv || !r.token_tag) return null;

  return decryptToken({
    ciphertext: String(r.access_token_encrypted),
    iv: String(r.token_iv),
    tag: String(r.token_tag),
  });
}

// ── Salvar ────────────────────────────────────────────────────────────────────

export async function saveMetaIntegration(
  input: SaveMetaIntegrationInput
): Promise<{ id: string } | { error: string; detail?: string }> {
  const admin = createAdminClient();

  // Confirma que o cliente existe
  const { data: clientRow } = await admin
    .from("clients")
    .select("id")
    .eq("id", input.clientId)
    .maybeSingle();

  if (!clientRow) {
    return { error: "Cliente não encontrado." };
  }

  // Criptografa o token imediatamente — o plaintext não fica em nenhuma variável após este ponto
  let encrypted: ReturnType<typeof encryptToken>;
  try {
    encrypted = encryptToken(input.accessToken);
  } catch (err) {
    return {
      error: "Erro de criptografia.",
      detail:
        err instanceof Error ? err.message : "Falha ao criptografar token.",
    };
  }

  const now = new Date().toISOString();
  const payload = {
    client_id: input.clientId,
    provider: "meta_direct",
    channel: "meta_ads",
    account_id: input.accountId,
    account_name: input.accountName,
    access_token_encrypted: encrypted.ciphertext,
    token_iv: encrypted.iv,
    token_tag: encrypted.tag,
    token_last4: input.accessToken.slice(-4),
    token_status: "valid",
    last_validated_at: now,
    updated_at: now,
    status: "active",
  };

  // Lookup pelo UNIQUE (client_id, provider, channel, account_id) — um cliente pode ter múltiplas contas Meta
  const { data: existing } = await admin
    .from("client_integrations")
    .select("id")
    .eq("client_id", input.clientId)
    .eq("provider", "meta_direct")
    .eq("channel", "meta_ads")
    .eq("account_id", input.accountId)
    .maybeSingle();

  if (existing) {
    const existingId = String((existing as Record<string, unknown>).id);
    const { error: updateErr } = await admin
      .from("client_integrations")
      .update(payload)
      .eq("id", existingId);

    if (updateErr) {
      return { error: "Erro ao atualizar integração.", detail: updateErr.message };
    }
    return { id: existingId };
  }

  const { data: inserted, error: insertErr } = await admin
    .from("client_integrations")
    .insert(payload)
    .select("id")
    .maybeSingle();

  if (insertErr) {
    return { error: "Erro ao salvar integração.", detail: insertErr.message };
  }

  return { id: inserted ? String((inserted as Record<string, unknown>).id) : "" };
}

// ── Atualizar status ──────────────────────────────────────────────────────────

export async function updateMetaTokenStatus(
  integrationId: string,
  status: "valid" | "expired" | "invalid"
): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("client_integrations")
    .update({ token_status: status, last_validated_at: new Date().toISOString() })
    .eq("id", integrationId)
    .eq("provider", "meta_direct");
}

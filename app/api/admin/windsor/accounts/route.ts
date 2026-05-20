import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadUserContext } from "@/lib/data/user-context";
import { discoverWindsorAccounts } from "@/lib/integrations/windsor/accounts";

export interface WindsorAccountRow {
  accountName: string;
  accountId: string | null;
  mapped: boolean;
  clientId: string | null;
  clientName: string | null;
  integrationId: string | null;
}

export interface WindsorAccountsApiResponse {
  success: boolean;
  accounts: WindsorAccountRow[];
  error?: string;
}

function err(message: string, status: number) {
  return NextResponse.json<WindsorAccountsApiResponse>(
    { success: false, accounts: [], error: message },
    { status }
  );
}

export async function GET() {
  // ── Autenticação ──────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return err("Não autenticado.", 401);

  // ── Autorização ───────────────────────────────────────────────
  const ctx = await loadUserContext(user.id);
  if (!ctx.isAdmin) return err("Acesso restrito a administradores Vitti.", 403);

  // ── Descoberta de contas Windsor ──────────────────────────────
  const { accounts, error } = await discoverWindsorAccounts();

  if (error) return err(error, 502);

  if (!accounts.length) {
    return NextResponse.json<WindsorAccountsApiResponse>({
      success: true,
      accounts: [],
    });
  }

  // ── Mapeamentos existentes em client_integrations ─────────────
  const admin = createAdminClient();

  const { data: integrations } = await admin
    .from("client_integrations")
    .select("id, client_id, account_name, account_id")
    .eq("provider", "windsor")
    .eq("status", "active");

  // accountName → { integrationId, clientId }
  const mappingByAccount = new Map<
    string,
    { integrationId: string; clientId: string }
  >();

  for (const row of integrations ?? []) {
    const name = String(row.account_name ?? "").trim();
    if (name) {
      mappingByAccount.set(name, {
        integrationId: String(row.id),
        clientId: String(row.client_id ?? ""),
      });
    }
  }

  // ── Nome dos clientes mapeados ────────────────────────────────
  const mappedClientIds = [
    ...new Set([...mappingByAccount.values()].map((m) => m.clientId).filter(Boolean)),
  ];

  const clientNameById = new Map<string, string>();

  if (mappedClientIds.length > 0) {
    const { data: clientRows } = await admin
      .from("clients")
      .select("id, name")
      .in("id", mappedClientIds);

    for (const row of clientRows ?? []) {
      clientNameById.set(String(row.id), String(row.name ?? ""));
    }
  }

  // ── Monta resposta ────────────────────────────────────────────
  const result: WindsorAccountRow[] = accounts.map(({ accountName, accountId }) => {
    const mapping = mappingByAccount.get(accountName) ?? null;
    return {
      accountName,
      accountId,
      mapped: !!mapping,
      clientId: mapping?.clientId ?? null,
      clientName: mapping ? (clientNameById.get(mapping.clientId) ?? null) : null,
      integrationId: mapping?.integrationId ?? null,
    };
  });

  return NextResponse.json<WindsorAccountsApiResponse>({
    success: true,
    accounts: result,
  });
}

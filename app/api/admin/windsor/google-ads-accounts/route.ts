import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadUserContext } from "@/lib/data/user-context";
import { testGoogleAdsFields } from "@/lib/integrations/windsor/google-ads-test";

export interface GoogleAdsAccountRow {
  accountName: string;
  mapped: boolean;
  clientId: string | null;
  clientName: string | null;
  integrationId: string | null;
}

export interface GoogleAdsAccountsApiResponse {
  success: boolean;
  accounts: GoogleAdsAccountRow[];
  error?: string;
}

function err(message: string, status: number) {
  return NextResponse.json<GoogleAdsAccountsApiResponse>(
    { success: false, accounts: [], error: message },
    { status }
  );
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return err("Não autenticado.", 401);

  const ctx = await loadUserContext(user.id);
  if (!ctx.isAdmin) return err("Acesso restrito a administradores Vitti.", 403);

  // Descobre contas Google Ads via Windsor
  const testResult = await testGoogleAdsFields();
  if (!testResult.success) {
    return err(testResult.error ?? "Erro ao buscar contas Google Ads.", 502);
  }

  const discoveredAccounts = testResult.googleAdsAccounts;

  if (!discoveredAccounts.length) {
    return NextResponse.json<GoogleAdsAccountsApiResponse>({ success: true, accounts: [] });
  }

  // Busca mapeamentos existentes
  const admin = createAdminClient();

  const { data: integrations } = await admin
    .from("client_integrations")
    .select("id, client_id, account_name")
    .eq("provider", "windsor")
    .eq("channel", "google_ads")
    .eq("status", "active");

  const mappingByAccount = new Map<string, { integrationId: string; clientId: string }>();
  for (const row of integrations ?? []) {
    const name = String(row.account_name ?? "").trim();
    if (name) {
      mappingByAccount.set(name, {
        integrationId: String(row.id),
        clientId: String(row.client_id ?? ""),
      });
    }
  }

  // Busca nomes dos clientes mapeados
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

  const accounts: GoogleAdsAccountRow[] = discoveredAccounts.map((accountName) => {
    const mapping = mappingByAccount.get(accountName) ?? null;
    return {
      accountName,
      mapped: !!mapping,
      clientId: mapping?.clientId ?? null,
      clientName: mapping ? (clientNameById.get(mapping.clientId) ?? null) : null,
      integrationId: mapping?.integrationId ?? null,
    };
  });

  return NextResponse.json<GoogleAdsAccountsApiResponse>({ success: true, accounts });
}

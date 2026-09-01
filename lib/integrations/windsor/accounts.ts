import "server-only";
import { fetchWindsorConnectedAccounts } from "./client";

export interface WindsorDiscoveredAccount {
  accountName: string;
  accountId: string | null;
}

// Descobre contas Meta Ads conectadas ao workspace Windsor via endpoint dedicado (ds-accounts).
// Não depende de atividade recente — retorna todas as contas configuradas no conector Facebook Ads,
// mesmo que estejam pausadas ou sem gasto nos últimos 7 dias.
// Deduplicação: account_id como chave primária; account_name como fallback.
export async function discoverWindsorAccounts(): Promise<{
  accounts: WindsorDiscoveredAccount[];
  error?: string;
}> {
  const response = await fetchWindsorConnectedAccounts("facebook");

  if (response.error) {
    const detail = response.errorDetail ? ` — ${response.errorDetail}` : "";
    return { accounts: [], error: response.error + detail };
  }

  if (!response.accounts.length) {
    return { accounts: [] };
  }

  const seenById = new Set<string>();
  const seenByName = new Set<string>();
  const accounts: WindsorDiscoveredAccount[] = [];

  for (const { accountId, accountName } of response.accounts) {
    if (seenById.has(accountId)) continue;
    if (seenByName.has(accountName)) continue;

    seenById.add(accountId);
    seenByName.add(accountName);
    accounts.push({ accountName, accountId });
  }

  accounts.sort((a, b) => a.accountName.localeCompare(b.accountName, "pt-BR"));
  return { accounts };
}

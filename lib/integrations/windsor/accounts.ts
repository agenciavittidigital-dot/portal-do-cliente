import "server-only";
import { fetchWindsorRawData } from "./client";
import type { WindsorApiResponse } from "./types";

export interface WindsorDiscoveredAccount {
  accountName: string;
  accountId: string | null;
}

// Busca a Windsor e agrupa registros únicos por account_name.
// Retorna lista deduplicada ordenada alfabeticamente.
export async function discoverWindsorAccounts(): Promise<{
  accounts: WindsorDiscoveredAccount[];
  error?: string;
}> {
  const response: WindsorApiResponse = await fetchWindsorRawData();

  if (response.error) {
    const detail = response.errorDetail ? ` — ${response.errorDetail}` : "";
    return { accounts: [], error: response.error + detail };
  }

  if (!response.data?.length) {
    return { accounts: [] };
  }

  const seen = new Map<string, string | null>();

  for (const record of response.data) {
    const name =
      typeof record.account_name === "string" && record.account_name.trim()
        ? record.account_name.trim()
        : null;

    if (!name) continue;

    if (!seen.has(name)) {
      const id =
        typeof record.account_id === "string" && record.account_id.trim()
          ? record.account_id.trim()
          : null;
      seen.set(name, id);
    }
  }

  const accounts: WindsorDiscoveredAccount[] = Array.from(seen.entries())
    .map(([accountName, accountId]) => ({ accountName, accountId }))
    .sort((a, b) => a.accountName.localeCompare(b.accountName, "pt-BR"));

  return { accounts };
}

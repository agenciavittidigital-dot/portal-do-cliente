import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import {
  loadActiveClients,
  loadClientDashboards,
} from "@/lib/data/dashboards";
import { ClientSelector } from "@/components/metricas/ClientSelector";
import { MetricasDashboard } from "@/components/metricas/MetricasDashboard";

export default async function MetricasPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const params = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ctx = user ? await loadUserContext(user.id) : null;
  const isAdmin = ctx?.isAdmin ?? false;

  // ── Determina cliente alvo ────────────────────────────────────
  // Admin: lista todos os clientes ativos, valida o ?clientId param.
  // Client_user: usa o cliente vinculado ao contexto.

  let targetClientId: string | null = null;

  if (isAdmin) {
    const { clients, loadError } = await loadActiveClients();
    const requestedId = params.clientId ?? null;
    const valid = requestedId
      ? clients.some((c) => c.id === requestedId)
      : false;

    const dashboards =
      valid && requestedId ? await loadClientDashboards(requestedId) : [];

    if (valid) targetClientId = requestedId;

    return (
      <div className="space-y-6 max-w-6xl">
        <div>
          <h2 className="text-xl font-light text-white/90 tracking-wide">
            Dados e Métricas
          </h2>
          <p className="text-sm text-white/25 mt-0.5 font-light">
            Acompanhe a performance das suas campanhas por plataforma
          </p>
        </div>

        <ClientSelector
          clients={clients}
          selectedClientId={targetClientId}
          loadError={loadError}
        />

        {targetClientId && <MetricasDashboard dashboards={dashboards} />}
      </div>
    );
  }

  // ── Client_user: usa cliente do contexto ──────────────────────
  targetClientId = ctx?.client?.id ?? null;

  const dashboards = targetClientId
    ? await loadClientDashboards(targetClientId)
    : [];

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h2 className="text-xl font-light text-white/90 tracking-wide">
          Dados e Métricas
        </h2>
        <p className="text-sm text-white/25 mt-0.5 font-light">
          Acompanhe a performance das suas campanhas por plataforma
        </p>
      </div>

      {targetClientId ? (
        <MetricasDashboard dashboards={dashboards} />
      ) : (
        <div className="flex flex-col items-center justify-center py-20 gap-3 rounded-xl border border-dashed border-white/5">
          <p className="text-sm font-light text-white/30">
            Nenhum cliente vinculado à sua conta.
          </p>
          <p className="text-xs text-white/20 font-light">
            Contate a equipe Vitti para vinculação.
          </p>
        </div>
      )}
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import { loadUserContext } from "@/lib/data/user-context";
import { loadActiveClients, loadClientDashboards } from "@/lib/data/dashboards";
import { computeDateRange, loadPerformanceData, loadGoogleAdsCampaigns, loadCreativesData } from "@/lib/data/performance";
import { ClientSelector } from "@/components/metricas/ClientSelector";
import { MetricasDashboard } from "@/components/metricas/MetricasDashboard";

export default async function MetricasPage({
  searchParams,
}: {
  searchParams: Promise<{
    clientId?: string;
    period?: string;
    startDate?: string;
    endDate?: string;
  }>;
}) {
  const params = await searchParams;

  // ── Parâmetros de filtro ──────────────────────────────────────
  const period = params.period ?? "last_7_days";
  const startDate = params.startDate ?? "";
  const endDate = params.endDate ?? "";

  const { start: perfStart, end: perfEnd } = computeDateRange(period, startDate, endDate);
  // ── Auth ──────────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ctx = user ? await loadUserContext(user.id) : null;
  const isAdmin = ctx?.isAdmin ?? false;

  const filterProps = {
    initialPeriod: period,
    initialStartDate: startDate,
    initialEndDate: endDate,
  };

  // ── Admin ─────────────────────────────────────────────────────
  if (isAdmin) {
    const { clients, loadError } = await loadActiveClients();
    const requestedId = params.clientId ?? null;
    const valid = requestedId ? clients.some((c) => c.id === requestedId) : false;

    const dashboards =
      valid && requestedId ? await loadClientDashboards(requestedId) : [];

    const [performance, performanceGoogleAds, googleAdsCampaigns, creativesMetaAds] =
      valid && requestedId
        ? await Promise.all([
            loadPerformanceData(requestedId, "meta_ads", perfStart, perfEnd),
            loadPerformanceData(requestedId, "google_ads", perfStart, perfEnd),
            loadGoogleAdsCampaigns(requestedId, perfStart, perfEnd),
            loadCreativesData(requestedId, perfStart, perfEnd),
          ])
        : [null, null, [], []];

    const targetClientId = valid ? requestedId : null;

    return (
      <div className="space-y-6 max-w-6xl">
        <div>
          <h2 className="text-xl font-light text-[#171f38] tracking-wide">
            Dados e Métricas
          </h2>
          <p className="text-sm text-[#171f38]/60 mt-0.5 font-light">
            Acompanhe a performance das suas campanhas por canal de aquisição.
          </p>
        </div>

        <ClientSelector
          clients={clients}
          selectedClientId={targetClientId}
          loadError={loadError}
        />

        {targetClientId && (
          <MetricasDashboard
            dashboards={dashboards}
            performance={performance}
            performanceGoogleAds={performanceGoogleAds}
            googleAdsCampaigns={googleAdsCampaigns ?? []}
            creativesMetaAds={creativesMetaAds ?? []}
            {...filterProps}
          />
        )}
      </div>
    );
  }

  // ── Client_user ───────────────────────────────────────────────
  const targetClientId = ctx?.client?.id ?? null;

  const dashboards = targetClientId
    ? await loadClientDashboards(targetClientId)
    : [];

  const [performance, performanceGoogleAds, googleAdsCampaigns, creativesMetaAds] = targetClientId
    ? await Promise.all([
        loadPerformanceData(targetClientId, "meta_ads", perfStart, perfEnd),
        loadPerformanceData(targetClientId, "google_ads", perfStart, perfEnd),
        loadGoogleAdsCampaigns(targetClientId, perfStart, perfEnd),
        loadCreativesData(targetClientId, perfStart, perfEnd),
      ])
    : [null, null, [], []];

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h2 className="text-xl font-light text-vitti-blue tracking-wide">
          Dados e Métricas
        </h2>
        <p className="text-sm text-vitti-blue/50 mt-0.5 font-light">
          Acompanhe a performance das suas campanhas por plataforma
        </p>
      </div>

      {targetClientId ? (
        <MetricasDashboard
          dashboards={dashboards}
          performance={performance}
          performanceGoogleAds={performanceGoogleAds}
          googleAdsCampaigns={googleAdsCampaigns ?? []}
          creativesMetaAds={creativesMetaAds ?? []}
          {...filterProps}
        />
      ) : (
        <div className="flex flex-col items-center justify-center py-20 gap-3 rounded-xl border border-dashed border-black/[0.07]">
          <p className="text-sm font-light text-[#5F6368]/60">
            Nenhum cliente vinculado à sua conta.
          </p>
          <p className="text-xs text-[#5F6368]/45 font-light">
            Contate a equipe Vitti para vinculação.
          </p>
        </div>
      )}
    </div>
  );
}

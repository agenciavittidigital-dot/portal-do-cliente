import { Badge } from "@/components/ui/Badge";
import { DashboardsAdminPanel, BackToAdmin } from "@/components/admin/DashboardsAdminPanel";
import { listAdminClients } from "@/lib/data/clients-admin";
import { listClientDashboardConfig } from "@/lib/data/dashboards-admin";
import { BarChart3 } from "lucide-react";

export default async function AdminDashboardsPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const { clientId } = await searchParams;

  const [allClients, initialConfig] = await Promise.all([
    listAdminClients(),
    clientId ? listClientDashboardConfig(clientId) : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6 max-w-5xl">
      <BackToAdmin />

      <div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center shrink-0">
            <BarChart3 size={14} className="text-vitti-light/40" />
          </div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-light text-white/90 tracking-wide">Dashboards</h2>
            <Badge label="Admin" variant="info" />
          </div>
        </div>
        <p className="text-sm text-white/25 mt-1.5 font-light">
          Visualize e configure os dashboards dos clientes — blocos, métricas e visibilidade.
        </p>
      </div>

      <DashboardsAdminPanel
        initialClients={allClients}
        initialConfig={initialConfig}
        initialClientId={clientId ?? null}
      />
    </div>
  );
}

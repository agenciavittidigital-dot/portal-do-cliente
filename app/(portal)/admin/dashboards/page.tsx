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
          <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200/60 flex items-center justify-center shrink-0">
            <BarChart3 size={14} className="text-vitti-light/60" />
          </div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-light text-vitti-blue tracking-wide">Dashboards</h2>
            <Badge label="Admin" variant="info" />
          </div>
        </div>
        <p className="text-sm text-vitti-blue/50 mt-1.5 font-light">
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

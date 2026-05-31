import { Badge } from "@/components/ui/Badge";
import { ClientsAdminPanel, BackToAdmin } from "@/components/admin/ClientsAdminPanel";
import { listAdminClients } from "@/lib/data/clients-admin";
import { Users } from "lucide-react";

export default async function AdminClientesPage() {
  const clients = await listAdminClients();

  return (
    <div className="space-y-6 max-w-5xl">
      {/* ── Breadcrumb ────────────────────────────────────────────── */}
      <BackToAdmin />

      {/* ── Header ───────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-vitti-gray/[0.08] border border-vitti-gray/[0.14] flex items-center justify-center shrink-0">
            <Users size={14} className="text-vitti-light/60" />
          </div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-light text-vitti-blue tracking-wide">Clientes</h2>
            <Badge label="Admin" variant="info" />
          </div>
        </div>
        <p className="text-sm text-vitti-blue/50 mt-1.5 font-light">
          Gerencie os clientes do portal — crie, edite, ative e configure dashboards padrão.
        </p>
      </div>

      {/* ── Panel ────────────────────────────────────────────────── */}
      <ClientsAdminPanel initialClients={clients} />
    </div>
  );
}

import { Badge } from "@/components/ui/Badge";
import { CallsAdminPanel, BackToAdmin } from "@/components/admin/CallsAdminPanel";
import { listAdminClients } from "@/lib/data/clients-admin";
import { Phone } from "lucide-react";

export default async function AdminCallsPage() {
  const clients = await listAdminClients();

  return (
    <div className="space-y-6 max-w-5xl">
      <BackToAdmin />

      <div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center shrink-0">
            <Phone size={14} className="text-vitti-light/40" />
          </div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-light text-white/90 tracking-wide">Calls</h2>
            <Badge label="Admin" variant="info" />
          </div>
        </div>
        <p className="text-sm text-white/25 mt-1.5 font-light">
          Gerencie calls por cliente — cadastro manual com link de gravação e resumo.
        </p>
      </div>

      <CallsAdminPanel allClients={clients} />
    </div>
  );
}

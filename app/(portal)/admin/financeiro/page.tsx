import { Badge } from "@/components/ui/Badge";
import { FinanceAdminPanel, BackToAdmin } from "@/components/admin/FinanceAdminPanel";
import { listAdminClients } from "@/lib/data/clients-admin";
import { CreditCard } from "lucide-react";

export default async function AdminFinanceiroPage() {
  const clients = await listAdminClients();

  return (
    <div className="space-y-6 max-w-5xl">
      <BackToAdmin />

      <div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center shrink-0">
            <CreditCard size={14} className="text-vitti-light/40" />
          </div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-light text-white/90 tracking-wide">Financeiro</h2>
            <Badge label="Admin" variant="info" />
          </div>
        </div>
        <p className="text-sm text-white/25 mt-1.5 font-light">
          Gerencie notas fiscais por cliente — registro manual de NFs emitidas.
        </p>
      </div>

      <FinanceAdminPanel allClients={clients} />
    </div>
  );
}

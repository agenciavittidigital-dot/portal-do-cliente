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
          <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200/60 flex items-center justify-center shrink-0">
            <CreditCard size={14} className="text-vitti-light/60" />
          </div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-light text-vitti-blue tracking-wide">Financeiro</h2>
            <Badge label="Admin" variant="info" />
          </div>
        </div>
        <p className="text-sm text-vitti-blue/50 mt-1.5 font-light">
          Gerencie notas fiscais por cliente — registro manual de NFs emitidas.
        </p>
      </div>

      <FinanceAdminPanel allClients={clients} />
    </div>
  );
}

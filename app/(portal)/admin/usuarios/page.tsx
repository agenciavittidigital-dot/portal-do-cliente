import { Badge } from "@/components/ui/Badge";
import { UsersAdminPanel, BackToAdmin } from "@/components/admin/UsersAdminPanel";
import { listAdminUsers, listPermissions, ensureDefaultPermissions } from "@/lib/data/users-admin";
import { listAdminClients } from "@/lib/data/clients-admin";
import { ShieldCheck } from "lucide-react";

export default async function AdminUsuariosPage() {
  // Garante permissões padrão — idempotente, não duplica
  const seedResult = await ensureDefaultPermissions();

  const [users, permissions, clients] = await Promise.all([
    listAdminUsers(),
    listPermissions(),
    listAdminClients(),
  ]);

  return (
    <div className="space-y-6 max-w-5xl">
      <BackToAdmin />

      <div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center shrink-0">
            <ShieldCheck size={14} className="text-vitti-light/40" />
          </div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-light text-white/90 tracking-wide">Usuários</h2>
            <Badge label="Admin" variant="info" />
          </div>
        </div>
        <p className="text-sm text-white/25 mt-1.5 font-light">
          Gerencie perfis, vínculos com clientes e permissões de acesso ao portal.
        </p>
      </div>

      <UsersAdminPanel
        initialUsers={users}
        allPermissions={permissions}
        allClients={clients}
        permSeedWarning={!seedResult.success ? seedResult.errorMessage : undefined}
      />
    </div>
  );
}

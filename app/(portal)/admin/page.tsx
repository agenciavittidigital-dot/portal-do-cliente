import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  Users,
  BarChart3,
  FileText,
  CreditCard,
  Megaphone,
  Plug,
  ScrollText,
  ShieldCheck,
} from "lucide-react";

const adminModules = [
  {
    label: "Clientes",
    icon: Users,
    description: "Gerenciar clientes e contratos",
  },
  {
    label: "Usuários",
    icon: ShieldCheck,
    description: "Controle de acesso e permissões",
  },
  {
    label: "Métricas",
    icon: BarChart3,
    description: "Dashboards e visualizações",
  },
  {
    label: "Integrações",
    icon: Plug,
    description: "Windsor AI e fontes de dados",
  },
  {
    label: "Relatórios",
    icon: FileText,
    description: "Geração e gestão de relatórios",
  },
  {
    label: "Financeiro",
    icon: CreditCard,
    description: "Pagamentos e cobranças",
  },
  {
    label: "Comunicados",
    icon: Megaphone,
    description: "Mensagens e notificações para clientes",
  },
  {
    label: "Logs",
    icon: ScrollText,
    description: "Auditoria e histórico de atividades",
  },
];

export default function AdminPage() {
  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-light text-white/90 tracking-wide">
            Admin
          </h2>
          <Badge label="Vitti Digital" variant="info" />
        </div>
        <p className="text-sm text-white/25 mt-0.5 font-light">
          Painel administrativo — acesso restrito
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {adminModules.map((mod) => {
          const Icon = mod.icon;
          return (
            <Card
              key={mod.label}
              className="hover:border-white/10 hover:bg-vitti-dark/60 transition-all cursor-pointer"
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon size={15} className="text-vitti-light/40" />
                    <CardTitle>{mod.label}</CardTitle>
                  </div>
                  <Badge label="Em breve" variant="default" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-[11px] text-white/20 font-light leading-relaxed">
                  {mod.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

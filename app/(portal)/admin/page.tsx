import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import {
  Users,
  BarChart3,
  FileText,
  CreditCard,
  Megaphone,
  ScrollText,
  ShieldCheck,
  Phone,
  Plug,
  ImageIcon,
} from "lucide-react";

const ACTIVE_MODULES = [
  { label: "Clientes", icon: Users, description: "Gerenciar clientes e contratos", href: "/admin/clientes" },
  { label: "Dashboards", icon: BarChart3, description: "Configurar dashboards e métricas por cliente", href: "/admin/dashboards" },
  { label: "Usuários", icon: ShieldCheck, description: "Perfis, vínculos e permissões de acesso", href: "/admin/usuarios" },
  { label: "Financeiro", icon: CreditCard, description: "Notas fiscais manuais por cliente", href: "/admin/financeiro" },
  { label: "Relatórios", icon: FileText, description: "Relatórios manuais por cliente", href: "/admin/relatorios" },
  { label: "Calls", icon: Phone, description: "Calls manuais com link de gravação por cliente", href: "/admin/calls" },
  { label: "Integrações", icon: Plug, description: "Windsor AI, sincronizações, mapeamento de contas e ferramentas avançadas", href: "/admin/integracoes" },
  { label: "Carrossel da Home", icon: ImageIcon, description: "Gerenciar banners exibidos no carrossel da Home do portal", href: "/admin/carrossel-home" },
];

const OTHER_MODULES = [
  { label: "Comunicados", icon: Megaphone, description: "Mensagens e notificações para clientes" },
  { label: "Logs", icon: ScrollText, description: "Auditoria e histórico de atividades" },
];

export default function AdminPage() {
  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-light text-vitti-blue tracking-wide">Admin</h2>
          <Badge label="Vitti Digital" variant="info" />
        </div>
        <p className="text-sm text-vitti-blue/50 mt-0.5 font-light">
          Painel administrativo — acesso restrito
        </p>
      </div>

      {/* ── Módulos ──────────────────────────────────────────────── */}
      <section>
        <p className="text-[9px] text-vitti-blue/40 tracking-[0.2em] uppercase font-light mb-3">
          Módulos
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {ACTIVE_MODULES.map((mod) => {
            const Icon = mod.icon;
            return (
              <Link key={mod.label} href={mod.href}>
                <Card className="hover:border-vitti-blue/30 hover:bg-vitti-blue/[0.06] transition-all cursor-pointer h-full">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon size={15} className="text-vitti-light/60" />
                        <CardTitle>{mod.label}</CardTitle>
                      </div>
                      <Badge label="Ativo" variant="success" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-[11px] text-vitti-blue/55 font-light leading-relaxed">
                      {mod.description}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}

          {OTHER_MODULES.map((mod) => {
            const Icon = mod.icon;
            return (
              <Card key={mod.label} className="opacity-60 cursor-default">
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
                  <p className="text-[11px] text-vitti-blue/45 font-light leading-relaxed">
                    {mod.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}

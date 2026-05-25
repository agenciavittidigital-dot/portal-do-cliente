import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { WindsorPreviewPanel } from "@/components/admin/WindsorPreviewPanel";
import { WindsorAccountMapping } from "@/components/admin/WindsorAccountMapping";
import { WindsorSyncPanel } from "@/components/admin/WindsorSyncPanel";
import { WindsorFieldsTestPanel } from "@/components/admin/WindsorFieldsTestPanel";
import { WindsorConversionTestPanel } from "@/components/admin/WindsorConversionTestPanel";
import { WindsorGoogleAdsPanel } from "@/components/admin/WindsorGoogleAdsPanel";
import { getWindsorStatus } from "@/lib/integrations/windsor/client";
import { loadActiveClients } from "@/lib/data/dashboards";
import Link from "next/link";
import {
  Users,
  BarChart3,
  FileText,
  CreditCard,
  Megaphone,
  ScrollText,
  ShieldCheck,
  Target,
  Phone,
} from "lucide-react";

const ACTIVE_MODULES = [
  { label: "Clientes", icon: Users, description: "Gerenciar clientes e contratos", href: "/admin/clientes" },
  { label: "Dashboards", icon: BarChart3, description: "Configurar dashboards e métricas por cliente", href: "/admin/dashboards" },
  { label: "Usuários", icon: ShieldCheck, description: "Perfis, vínculos e permissões de acesso", href: "/admin/usuarios" },
  { label: "Financeiro", icon: CreditCard, description: "Notas fiscais manuais por cliente", href: "/admin/financeiro" },
  { label: "Relatórios", icon: FileText, description: "Relatórios manuais por cliente", href: "/admin/relatorios" },
  { label: "Calls", icon: Phone, description: "Calls manuais com link de gravação por cliente", href: "/admin/calls" },
];

const OTHER_MODULES = [
  { label: "Comunicados", icon: Megaphone, description: "Mensagens e notificações para clientes" },
  { label: "Logs", icon: ScrollText, description: "Auditoria e histórico de atividades" },
];

export default async function AdminPage() {
  const windsorStatus = getWindsorStatus();
  const { clients } = await loadActiveClients();

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-light text-white/90 tracking-wide">Admin</h2>
          <Badge label="Vitti Digital" variant="info" />
        </div>
        <p className="text-sm text-white/25 mt-0.5 font-light">
          Painel administrativo — acesso restrito
        </p>
      </div>

      {/* ── Integrações ──────────────────────────────────────────── */}
      <section>
        <p className="text-[9px] text-white/[0.15] tracking-[0.2em] uppercase font-light mb-3">
          Integrações
        </p>
        <div className="space-y-3">
          {/* Windsor AI — painel de preview interativo */}
          <WindsorPreviewPanel
            windsorConfigured={windsorStatus.configured}
            maskedKey={windsorStatus.configured ? windsorStatus.maskedKey : undefined}
          />

          {/* Windsor — mapeamento de contas por cliente */}
          <WindsorAccountMapping clients={clients} />

          {/* Windsor — sincronização manual para performance_daily */}
          <WindsorSyncPanel />

          {/* Windsor — teste de campos avançados */}
          <WindsorFieldsTestPanel />

          {/* Windsor — diagnóstico de campos de conversão */}
          <WindsorConversionTestPanel />

          {/* Google Ads — mapeamento e sincronização */}
          <WindsorGoogleAdsPanel clients={clients} />

          {/* Meta Ads — sincronização automática (futura) */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.01]">
            <div className="flex items-center justify-between px-5 py-4 gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center shrink-0">
                  <Target size={14} className="text-vitti-light/30" />
                </div>
                <div>
                  <p className="text-xs font-light text-white/65">Meta Ads</p>
                  <p className="text-[10px] font-light text-white/25 mt-0.5">
                    Via Windsor AI — dados em performance_daily
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[9px] font-light px-2.5 py-1 rounded-full border border-white/[0.08] text-white/25 bg-white/[0.01]">
                  Sincronização manual
                </span>
                <button
                  disabled
                  className="text-[9px] font-light px-3 py-1.5 rounded-full border border-white/[0.07] text-white/20 cursor-not-allowed select-none"
                >
                  Sincronizar — Em breve
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Módulos ativos ───────────────────────────────────────── */}
      <section>
        <p className="text-[9px] text-white/[0.15] tracking-[0.2em] uppercase font-light mb-3">
          Módulos
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {ACTIVE_MODULES.map((mod) => {
            const Icon = mod.icon;
            return (
              <Link key={mod.label} href={mod.href}>
                <Card className="hover:border-vitti-blue/20 hover:bg-vitti-dark/60 transition-all cursor-pointer h-full">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon size={15} className="text-vitti-light/50" />
                        <CardTitle>{mod.label}</CardTitle>
                      </div>
                      <Badge label="Ativo" variant="success" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-[11px] text-white/30 font-light leading-relaxed">
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
              <Card
                key={mod.label}
                className="opacity-60 cursor-default"
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon size={15} className="text-vitti-light/25" />
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
      </section>
    </div>
  );
}

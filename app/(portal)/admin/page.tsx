import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { WindsorPreviewPanel } from "@/components/admin/WindsorPreviewPanel";
import { WindsorAccountMapping } from "@/components/admin/WindsorAccountMapping";
import { WindsorSyncPanel } from "@/components/admin/WindsorSyncPanel";
import { WindsorFieldsTestPanel } from "@/components/admin/WindsorFieldsTestPanel";
import { WindsorConversionTestPanel } from "@/components/admin/WindsorConversionTestPanel";
import { WindsorMetaRawProbePanel } from "@/components/admin/WindsorMetaRawProbePanel";
import { WindsorGoogleAdsPanel } from "@/components/admin/WindsorGoogleAdsPanel";
import { WindsorRegionalSyncPanel } from "@/components/admin/WindsorRegionalSyncPanel";
import { WindsorDemographicSyncPanel } from "@/components/admin/WindsorDemographicSyncPanel";
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
          <h2 className="text-xl font-light text-vitti-blue tracking-wide">Admin</h2>
          <Badge label="Vitti Digital" variant="info" />
        </div>
        <p className="text-sm text-vitti-blue/50 mt-0.5 font-light">
          Painel administrativo — acesso restrito
        </p>
      </div>

      {/* ── Integrações ──────────────────────────────────────────── */}
      <section>
        <p className="text-[9px] text-vitti-blue/40 tracking-[0.2em] uppercase font-light mb-3">
          Integrações
        </p>
        <div className="space-y-3">
          <WindsorPreviewPanel
            windsorConfigured={windsorStatus.configured}
            maskedKey={windsorStatus.configured ? windsorStatus.maskedKey : undefined}
          />

          <WindsorAccountMapping clients={clients} />

          <WindsorSyncPanel />

          <WindsorFieldsTestPanel />

          <WindsorConversionTestPanel />

          <WindsorMetaRawProbePanel />

          <WindsorGoogleAdsPanel clients={clients} />

          <WindsorRegionalSyncPanel />

          <WindsorDemographicSyncPanel />

          {/* Meta Ads — sincronização automática (futura) */}
          <div className="rounded-xl border bg-vitti-gray/[0.08] border-vitti-gray/[0.14] backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between px-5 py-4 gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-vitti-gray/[0.10] border border-vitti-gray/[0.14] flex items-center justify-center shrink-0">
                  <Target size={14} className="text-vitti-light/60" />
                </div>
                <div>
                  <p className="text-xs font-light text-vitti-blue">Meta Ads</p>
                  <p className="text-[10px] font-light text-vitti-blue/50 mt-0.5">
                    Via Windsor AI — dados em performance_daily
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[9px] font-light px-2.5 py-1 rounded-full border border-vitti-gray/[0.20] text-vitti-blue/50 bg-vitti-gray/[0.06]">
                  Sincronização manual
                </span>
                <button
                  disabled
                  className="text-[9px] font-light px-3 py-1.5 rounded-full border border-vitti-gray/[0.14] text-vitti-blue/35 cursor-not-allowed select-none"
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
              <Card
                key={mod.label}
                className="opacity-60 cursor-default"
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

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { WindsorPreviewPanel } from "@/components/admin/WindsorPreviewPanel";
import { getWindsorStatus } from "@/lib/integrations/windsor/client";
import {
  Users,
  BarChart3,
  FileText,
  CreditCard,
  Megaphone,
  ScrollText,
  ShieldCheck,
  Target,
} from "lucide-react";

const OTHER_MODULES = [
  { label: "Clientes", icon: Users, description: "Gerenciar clientes e contratos" },
  { label: "Usuários", icon: ShieldCheck, description: "Controle de acesso e permissões" },
  { label: "Métricas", icon: BarChart3, description: "Dashboards e visualizações" },
  { label: "Relatórios", icon: FileText, description: "Geração e gestão de relatórios" },
  { label: "Financeiro", icon: CreditCard, description: "Pagamentos e cobranças" },
  { label: "Comunicados", icon: Megaphone, description: "Mensagens e notificações para clientes" },
  { label: "Logs", icon: ScrollText, description: "Auditoria e histórico de atividades" },
];

export default async function AdminPage() {
  const windsorStatus = getWindsorStatus();

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

          {/* Meta Ads */}
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

      {/* ── Outros módulos ───────────────────────────────────────── */}
      <section>
        <p className="text-[9px] text-white/[0.15] tracking-[0.2em] uppercase font-light mb-3">
          Módulos
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {OTHER_MODULES.map((mod) => {
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
      </section>
    </div>
  );
}

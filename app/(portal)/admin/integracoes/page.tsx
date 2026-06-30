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
import { ChevronLeft, Target } from "lucide-react";

export default async function IntegracoesPage() {
  const windsorStatus = getWindsorStatus();
  const { clients } = await loadActiveClients();

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-[11px] text-vitti-blue/40 hover:text-vitti-blue/70 transition-colors mb-4"
        >
          <ChevronLeft size={13} />
          Voltar para Admin
        </Link>
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-light text-vitti-blue tracking-wide">Integrações</h2>
          <Badge label="Vitti Digital" variant="info" />
        </div>
        <p className="text-sm text-vitti-blue/50 mt-0.5 font-light">
          Windsor AI, sincronizações e ferramentas avançadas
        </p>
      </div>

      {/* ── Meta Ads / Windsor ───────────────────────────────────── */}
      <section>
        <p className="text-[9px] text-vitti-blue/40 tracking-[0.2em] uppercase font-light mb-3">
          Meta Ads — Windsor AI
        </p>
        <div className="space-y-3">
          <WindsorPreviewPanel
            windsorConfigured={windsorStatus.configured}
            maskedKey={windsorStatus.configured ? windsorStatus.maskedKey : undefined}
          />
          <WindsorAccountMapping clients={clients} />
          <WindsorSyncPanel />
          <WindsorRegionalSyncPanel />
          <WindsorDemographicSyncPanel />

          {/* Meta Ads — sincronização automática (futura) */}
          <div className="rounded-2xl border border-white bg-white/60 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
            <div className="flex items-center justify-between px-5 py-4 gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200/60 flex items-center justify-center shrink-0">
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
                <span className="text-[9px] font-light px-2.5 py-1 rounded-full border border-slate-200 text-vitti-blue/50 bg-slate-100/60">
                  Sincronização manual
                </span>
                <button
                  disabled
                  className="text-[9px] font-light px-3 py-1.5 rounded-full border border-slate-200 text-vitti-blue/35 cursor-not-allowed select-none"
                >
                  Sincronizar — Em breve
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Google Ads / Windsor ─────────────────────────────────── */}
      <section>
        <p className="text-[9px] text-vitti-blue/40 tracking-[0.2em] uppercase font-light mb-3">
          Google Ads — Windsor AI
        </p>
        <div className="space-y-3">
          <WindsorGoogleAdsPanel clients={clients} />
        </div>
      </section>

      {/* ── Ferramentas avançadas ────────────────────────────────── */}
      <section>
        <p className="text-[9px] text-vitti-blue/40 tracking-[0.2em] uppercase font-light mb-3">
          Ferramentas avançadas
        </p>
        <div className="space-y-3">
          <WindsorFieldsTestPanel />
          <WindsorConversionTestPanel />
          <WindsorMetaRawProbePanel />
        </div>
      </section>
    </div>
  );
}

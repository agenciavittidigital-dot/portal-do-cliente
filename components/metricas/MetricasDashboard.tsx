"use client";

import { useState } from "react";
import { Target, Search, Globe, Users, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { DashboardBlockCard } from "./DashboardBlockCard";
import { MetaAdsView } from "./MetaAdsView";
import { GoogleAdsView } from "./GoogleAdsView";
import type { DashboardWithBlocks, PerformanceData, PlatformKey } from "@/types";
import type { GoogleAdsCampaignRow } from "@/lib/data/performance";

interface PlatformDef {
  key: PlatformKey;
  label: string;
  Icon: React.ElementType;
}

const PLATFORMS: PlatformDef[] = [
  { key: "meta_ads", label: "Meta Ads", Icon: Target },
  { key: "google_ads", label: "Google Ads", Icon: Search },
  { key: "seo", label: "SEO", Icon: Globe },
  { key: "social_media", label: "Social Media", Icon: Users },
];

interface Props {
  dashboards: DashboardWithBlocks[];
  performance?: PerformanceData | null;
  performanceGoogleAds?: PerformanceData | null;
  googleAdsCampaigns?: GoogleAdsCampaignRow[];
  initialPeriod?: string;
  initialView?: string;
  initialAnalysis?: string;
  initialStartDate?: string;
  initialEndDate?: string;
}

export function MetricasDashboard({
  dashboards,
  performance,
  performanceGoogleAds,
  googleAdsCampaigns,
  initialPeriod,
  initialView,
  initialAnalysis,
  initialStartDate,
  initialEndDate,
}: Props) {
  // Inicia no default_channel do primeiro dashboard (ex: "meta_ads")
  const initialChannel = (dashboards[0]?.dashboard.platform ?? "meta_ads") as PlatformKey;
  const [selected, setSelected] = useState<PlatformKey>(initialChannel);

  // ── Nenhum dashboard configurado para este cliente ────────────
  if (dashboards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 rounded-xl border border-dashed border-white/5">
        <div className="w-10 h-10 rounded-full bg-white/[0.03] border border-white/8 flex items-center justify-center">
          <BarChart3 size={16} className="text-white/15" />
        </div>
        <div className="text-center space-y-1.5">
          <p className="text-sm font-light text-white/40">
            Nenhum dashboard configurado
          </p>
          <p className="text-xs text-white/20 font-light max-w-xs leading-relaxed">
            Configure os blocos no painel Admin para este cliente.
          </p>
        </div>
      </div>
    );
  }

  // ── Blocos do canal selecionado (filtro client-side por block.channel) ─
  // A estrutura real tem um dashboard por cliente; cada bloco tem channel.
  const blocksForChannel = dashboards
    .flatMap((d) => d.blocks)
    .filter(({ block }) => block.channel === selected);

  // Canais configurados = união de available_channels de todos os dashboards
  const configuredPlatforms = new Set(
    dashboards.flatMap((d) => d.dashboard.available_channels)
  );

  return (
    <div className="space-y-6">
      {/* ── Seletor de plataforma ─────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        {PLATFORMS.map(({ key, label, Icon }) => {
          const isConfigured = configuredPlatforms.has(key);
          const isActive = selected === key;
          return (
            <button
              key={key}
              onClick={() => setSelected(key)}
              className={cn(
                "relative flex items-center gap-2 px-4 py-2 rounded-full text-xs font-light border transition-all duration-150",
                isActive
                  ? "bg-vitti-blue/15 border-vitti-blue/25 text-vitti-light"
                  : "border-white/8 text-white/30 hover:text-white/60 hover:border-white/15"
              )}
            >
              <Icon size={12} />
              {label}
              {isConfigured && (
                <span
                  className={cn(
                    "w-1.5 h-1.5 rounded-full shrink-0",
                    isActive ? "bg-vitti-light/60" : "bg-white/20"
                  )}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Blocos do canal ───────────────────────────────────── */}
      {selected === "google_ads" ? (
        <GoogleAdsView performance={performanceGoogleAds} campaigns={googleAdsCampaigns} />
      ) : blocksForChannel.length > 0 ? (
        selected === "meta_ads" ? (
          <MetaAdsView
            blocks={blocksForChannel}
            performance={performance}
            initialPeriod={initialPeriod}
            initialView={initialView}
            initialAnalysis={initialAnalysis}
            initialStartDate={initialStartDate}
            initialEndDate={initialEndDate}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {blocksForChannel.map(({ block, metrics }) => (
              <DashboardBlockCard
                key={block.id}
                block={block}
                metrics={metrics}
              />
            ))}
          </div>
        )
      ) : (
        <NoDashboard
          label={PLATFORMS.find((p) => p.key === selected)?.label ?? selected}
        />
      )}
    </div>
  );
}

function NoDashboard({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 rounded-xl border border-dashed border-white/5">
      <div className="w-10 h-10 rounded-full bg-white/[0.03] border border-white/8 flex items-center justify-center">
        <BarChart3 size={16} className="text-white/15" />
      </div>
      <div className="text-center space-y-1.5">
        <p className="text-sm font-light text-white/40">{label}</p>
        <p className="text-xs text-white/20 font-light max-w-xs leading-relaxed">
          Dashboard para este canal ainda não foi configurado.
          <br />
          A equipe Vitti irá configurá-lo em breve.
        </p>
      </div>
    </div>
  );
}

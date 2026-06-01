"use client";

import { useState } from "react";
import Image from "next/image";
import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { DashboardBlockCard } from "./DashboardBlockCard";
import { MetaAdsView } from "./MetaAdsView";
import { GoogleAdsView } from "./GoogleAdsView";
import type { DashboardWithBlocks, PerformanceData, PlatformKey } from "@/types";
import type { GoogleAdsCampaignRow, CreativeRow } from "@/lib/data/performance";
import type { RegionRow, DemographicRow } from "@/lib/data/performance-breakdowns";

interface PlatformDef {
  key: PlatformKey;
  label: string;
  logoSrc: string;
}

const PLATFORMS: PlatformDef[] = [
  { key: "meta_ads", label: "Meta Ads", logoSrc: "/assets/meta-logo.png" },
  { key: "google_ads", label: "Google Ads", logoSrc: "/assets/google-ads-logo.png" },
];

interface Props {
  dashboards: DashboardWithBlocks[];
  performance?: PerformanceData | null;
  performanceGoogleAds?: PerformanceData | null;
  googleAdsCampaigns?: GoogleAdsCampaignRow[];
  creativesMetaAds?: CreativeRow[] | null;
  regionBreakdown?: RegionRow[] | null;
  demographicBreakdown?: DemographicRow[] | null;
  initialPeriod?: string;
  initialStartDate?: string;
  initialEndDate?: string;
}

export function MetricasDashboard({
  dashboards,
  performance,
  performanceGoogleAds,
  googleAdsCampaigns,
  creativesMetaAds,
  regionBreakdown,
  demographicBreakdown,
  initialPeriod,
  initialStartDate,
  initialEndDate,
}: Props) {
  const initialChannel = (dashboards[0]?.dashboard.platform ?? "meta_ads") as PlatformKey;
  const [selected, setSelected] = useState<PlatformKey>(initialChannel);

  if (dashboards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 rounded-xl border border-dashed border-vitti-gray/[0.20]">
        <div className="w-10 h-10 rounded-full bg-vitti-gray/[0.08] border border-vitti-gray/[0.14] flex items-center justify-center">
          <BarChart3 size={16} className="text-vitti-blue/30" />
        </div>
        <div className="text-center space-y-1.5">
          <p className="text-sm font-light text-vitti-blue/60">
            Nenhum dashboard configurado
          </p>
          <p className="text-xs text-vitti-blue/45 font-light max-w-xs leading-relaxed">
            Configure os blocos no painel Admin para este cliente.
          </p>
        </div>
      </div>
    );
  }

  const blocksForChannel = dashboards
    .flatMap((d) => d.blocks)
    .filter(({ block }) => block.channel === selected);

  return (
    <div className="space-y-6">
      {/* ── Seletor de plataforma ─────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        {PLATFORMS.map(({ key, label, logoSrc }) => {
          const isActive = selected === key;
          return (
            <button
              key={key}
              onClick={() => setSelected(key)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold border transition-all duration-150",
                isActive
                  ? "bg-[#171f38] border-[#638acc] hover:bg-[#1e2a47]"
                  : "bg-[#f1f1f1] border-[#455cab] hover:bg-[#e8e8e8]"
              )}
            >
              <Image
                src={logoSrc}
                alt={label}
                width={18}
                height={18}
                className="shrink-0 object-contain"
              />
              <span className="text-[#455cab]">{label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Blocos do canal ───────────────────────────────────── */}
      {selected === "google_ads" ? (
        <GoogleAdsView
          performance={performanceGoogleAds}
          campaigns={googleAdsCampaigns}
          initialPeriod={initialPeriod}
          initialStartDate={initialStartDate}
          initialEndDate={initialEndDate}
        />
      ) : blocksForChannel.length > 0 ? (
        selected === "meta_ads" ? (
          <MetaAdsView
            blocks={blocksForChannel}
            performance={performance}
            creatives={creativesMetaAds}
            regionBreakdown={regionBreakdown}
            demographicBreakdown={demographicBreakdown}
            initialPeriod={initialPeriod}
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
    <div className="flex flex-col items-center justify-center py-20 gap-4 rounded-xl border border-dashed border-vitti-gray/[0.20]">
      <div className="w-10 h-10 rounded-full bg-vitti-gray/[0.08] border border-vitti-gray/[0.14] flex items-center justify-center">
        <BarChart3 size={16} className="text-vitti-blue/30" />
      </div>
      <div className="text-center space-y-1.5">
        <p className="text-sm font-light text-vitti-blue/60">{label}</p>
        <p className="text-xs text-vitti-blue/45 font-light max-w-xs leading-relaxed">
          Dashboard para este canal ainda não foi configurado.
          <br />
          A equipe Vitti irá configurá-lo em breve.
        </p>
      </div>
    </div>
  );
}

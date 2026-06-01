"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Calendar, ChevronDown } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import type { PerformanceData, PerformanceRow } from "@/types";
import type { GoogleAdsCampaignRow } from "@/lib/data/performance";

// ── Filtro de período ─────────────────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { value: "today",        label: "Hoje" },
  { value: "yesterday",    label: "Ontem" },
  { value: "last_7_days",  label: "Últimos 7 dias" },
  { value: "last_14_days", label: "Últimos 14 dias" },
  { value: "last_30_days", label: "Últimos 30 dias" },
  { value: "this_month",   label: "Este mês" },
  { value: "last_month",   label: "Mês passado" },
  { value: "custom",       label: "Personalizado" },
];

function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function resolvePeriodLabel(period: string, start: string, end: string): string {
  if (period === "custom") {
    if (start && end) return `${formatDateBR(start)} - ${formatDateBR(end)}`;
    return "Personalizado";
  }
  return PERIOD_OPTIONS.find((o) => o.value === period)?.label ?? "Período";
}

function PeriodFilter({
  period,
  customStart,
  customEnd,
  onChange,
}: {
  period: string;
  customStart: string;
  customEnd: string;
  onChange: (period: string, start: string, end: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const label = resolvePeriodLabel(period, customStart, customEnd);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#638acc] bg-[#4a589a] text-[10px] font-light text-white select-none hover:bg-[#3f4d87] transition-colors"
      >
        <Calendar size={9} className="shrink-0" />
        <span className="max-w-[160px] truncate">{label}</span>
        <ChevronDown
          size={8}
          className={cn("shrink-0 transition-transform duration-150", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="absolute top-full mt-2 right-0 z-50 min-w-[210px] rounded-xl border border-[#dfdedf] bg-white shadow-xl shadow-black/[0.08] overflow-hidden">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                if (opt.value === "custom") {
                  onChange("custom", customStart, customEnd);
                } else {
                  onChange(opt.value, "", "");
                  setOpen(false);
                }
              }}
              className={cn(
                "w-full text-left px-4 py-2.5 text-[11px] font-light transition-colors",
                period === opt.value
                  ? "text-[#455cab] bg-[#455cab]/[0.10]"
                  : "text-[#455cab]/60 hover:text-[#455cab] hover:bg-[#455cab]/[0.06]"
              )}
            >
              {opt.label}
            </button>
          ))}

          {period === "custom" && (
            <div className="border-t border-[#dfdedf] px-4 py-3 space-y-2 bg-[#f1f1f1]/40">
              <p className="text-[9px] text-[#455cab]/40 tracking-[0.1em] uppercase font-light">
                Período personalizado
              </p>
              <input
                type="date"
                value={customStart}
                max={customEnd || undefined}
                onChange={(e) => onChange("custom", e.target.value, customEnd)}
                className="w-full bg-white border border-[#dfdedf] rounded-lg px-3 py-2 text-[11px] text-[#455cab]/60 font-light focus:outline-none focus:border-[#455cab]/40 transition-colors [color-scheme:light]"
              />
              <input
                type="date"
                value={customEnd}
                min={customStart || undefined}
                onChange={(e) => onChange("custom", customStart, e.target.value)}
                className="w-full bg-white border border-[#dfdedf] rounded-lg px-3 py-2 text-[11px] text-[#455cab]/60 font-light focus:outline-none focus:border-[#455cab]/40 transition-colors [color-scheme:light]"
              />
              {customStart && customEnd && (
                <button
                  onClick={() => setOpen(false)}
                  className="w-full py-2 rounded-lg bg-[#455cab]/[0.15] border border-[#455cab]/20 text-[11px] text-[#455cab] font-light hover:bg-[#455cab]/[0.22] transition-colors"
                >
                  Aplicar
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Formatadores ──────────────────────────────────────────────────────────────

function fmtCurrency(v: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
}

function fmtNum(v: number): string {
  return new Intl.NumberFormat("pt-BR").format(Math.round(v));
}

function fmtPct(v: number): string {
  return `${v.toFixed(2)}%`;
}

function fmtAxisDate(iso: string): string {
  const p = iso.split("-");
  return `${p[2]}/${p[1]}`;
}

function fmtAxisSpend(v: number): string {
  if (v >= 1000) return `R$${(v / 1000).toFixed(0)}k`;
  return `R$${Math.round(v)}`;
}

function fmtAxisCount(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
  return String(Math.round(v));
}

// ── Sparkline (mesmo padrão do MetaAdsView) ───────────────────────────────────

function Sparkline({
  data,
  dataKey,
  color,
}: {
  data: PerformanceRow[];
  dataKey: string;
  color: string;
}) {
  if (data.length < 2) return <div className="h-10" />;
  const gradientId = `gads-sg-${dataKey}`;
  return (
    <ResponsiveContainer width="100%" height={40}>
      <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 4 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#${gradientId})`}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── KPI Card (mesmo padrão visual do MetaAdsView) ─────────────────────────────

interface KpiCardProps {
  label: string;
  value: string | null;
  pending?: boolean;
  rows?: PerformanceRow[];
  sparkKey?: string;
  sparkColor?: string;
}

function KpiCard({
  label,
  value,
  pending = false,
  rows = [],
  sparkKey,
  sparkColor = "#455CAB",
}: KpiCardProps) {
  const hasData = !pending && value !== null;
  const hasSparkline = !!sparkKey && rows.length >= 2;

  return (
    <div
      className={cn(
        "rounded-xl border bg-[#f1f1f1] border-[#dfdedf] flex flex-col gap-1 min-w-0 overflow-hidden",
        hasSparkline ? "pt-4 px-4 pb-0" : "p-4"
      )}
    >
      <p className="text-[11px] text-[#171f38] font-light tracking-wide truncate">{label}</p>
      <p
        className={cn(
          "text-xl font-bold tabular-nums leading-none mt-0.5",
          hasData ? "text-[#455cab]" : "text-[#455cab]/30"
        )}
      >
        {pending ? "—" : (value ?? "—")}
      </p>
      {hasSparkline && (
        <div className="-mx-4 mt-2">
          <Sparkline data={rows} dataKey={sparkKey} color={sparkColor} />
        </div>
      )}
    </div>
  );
}

// ── Tooltip do gráfico (mesmo padrão do MetaAdsView) ─────────────────────────

const CHART_LABEL_MAP: Record<string, string> = {
  spend:  "Investimento",
  clicks: "Cliques",
  leads:  "Conversões",
};

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const parts = (label ?? "").split("-");
  const dateLabel =
    parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : label;

  return (
    <div className="rounded-xl border border-[#dfdedf] bg-white shadow-lg px-3 py-2.5 space-y-1.5 min-w-[148px]">
      <p className="text-[9px] text-[#171f38]/50 font-light">{dateLabel}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-3">
          <span className="text-[9px] text-[#171f38]/60 font-light">
            {CHART_LABEL_MAP[entry.name] ?? entry.name}
          </span>
          <span
            className="text-[10px] font-bold tabular-nums"
            style={{ color: entry.color }}
          >
            {entry.name === "spend" ? fmtCurrency(entry.value) : fmtNum(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Gráfico de evolução (padrão AreaChart do MetaAdsView) ─────────────────────

interface EvoSeries {
  key: string;
  label: string;
  color: string;
  axis: "left" | "right";
}

function EvolutionChart({
  rows,
  hasConversions,
}: {
  rows: PerformanceRow[];
  hasConversions: boolean;
}) {
  const series: EvoSeries[] = [
    { key: "spend",  label: "Investimento", color: "#455cab", axis: "left"  },
    { key: "clicks", label: "Cliques",      color: "#638acc", axis: "right" },
    ...(hasConversions
      ? [{ key: "leads", label: "Conversões", color: "#28b52e", axis: "right" as const }]
      : []),
  ];

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border bg-[#f1f1f1] border-[#dfdedf] p-4 flex flex-col">
        <h4 className="text-[11px] font-light text-[#455cab] tracking-wide mb-1">
          Evolução no período
        </h4>
        <div className="min-h-[160px] flex flex-col items-center justify-center gap-2">
          <BarChart3 size={16} className="text-[#455cab]/20" />
          <p className="text-[10px] text-[#171f38]/30 font-light">
            Aguardando sincronização
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-[#f1f1f1] border-[#dfdedf] p-4 flex flex-col">
      <h4 className="text-[11px] font-light text-[#455cab] tracking-wide mb-3">
        Evolução no período
      </h4>
      {/* Legenda — mesmo padrão do MetaAdsView */}
      <div className="flex flex-wrap gap-4 mb-3">
        {series.map(({ key, label, color }) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className="w-3 h-[2px] rounded" style={{ backgroundColor: color }} />
            <span className="text-[9px] text-[#171f38]/55 font-light">{label}</span>
          </div>
        ))}
      </div>
      {/* Gráfico */}
      <div className="flex-1 min-h-[160px]">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={rows} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <defs>
              {series.map(({ key, color }) => (
                <linearGradient key={key} id={`gads-evo-${key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} stroke="rgba(0,0,0,0.05)" />
            <XAxis
              dataKey="date"
              tickFormatter={fmtAxisDate}
              tick={{ fill: "#171f38", fontSize: 8, fontWeight: 300 }}
              axisLine={false}
              tickLine={false}
              dy={4}
            />
            <YAxis
              yAxisId="left"
              tickFormatter={fmtAxisSpend}
              tick={{ fill: "rgba(0,0,0,0.22)", fontSize: 7, fontWeight: 300 }}
              axisLine={false}
              tickLine={false}
              width={38}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tickFormatter={fmtAxisCount}
              tick={{ fill: "rgba(0,0,0,0.22)", fontSize: 7, fontWeight: 300 }}
              axisLine={false}
              tickLine={false}
              width={26}
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ stroke: "rgba(0,0,0,0.06)", strokeWidth: 1 }}
            />
            {series.map(({ key, color, axis }) => (
              <Area
                key={key}
                yAxisId={axis}
                type="monotone"
                dataKey={key}
                stroke={color}
                strokeWidth={1.5}
                fill={`url(#gads-evo-${key})`}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0 }}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}


// ── GoogleAdsView ─────────────────────────────────────────────────────────────

interface Props {
  performance?: PerformanceData | null;
  campaigns?: GoogleAdsCampaignRow[];
  initialPeriod?: string;
  initialStartDate?: string;
  initialEndDate?: string;
}

export function GoogleAdsView({
  performance,
  campaigns: _campaigns = [],
  initialPeriod = "last_7_days",
  initialStartDate = "",
  initialEndDate = "",
}: Props) {
  const router = useRouter();
  const [period, setPeriod] = useState(initialPeriod);
  const [customStart, setCustomStart] = useState(initialStartDate);
  const [customEnd, setCustomEnd] = useState(initialEndDate);

  function handlePeriodChange(p: string, start: string, end: string) {
    setPeriod(p);
    setCustomStart(start);
    setCustomEnd(end);

    const url = new URL(window.location.href);
    url.searchParams.set("period", p);
    if (p === "custom") {
      if (start) url.searchParams.set("startDate", start);
      else url.searchParams.delete("startDate");
      if (end) url.searchParams.set("endDate", end);
      else url.searchParams.delete("endDate");
    } else {
      url.searchParams.delete("startDate");
      url.searchParams.delete("endDate");
    }
    router.replace(url.pathname + url.search, { scroll: false });
  }

  if (!performance) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 rounded-xl border border-dashed border-[#dfdedf]">
        <div className="w-10 h-10 rounded-full bg-[#f1f1f1] border border-[#dfdedf] flex items-center justify-center">
          <BarChart3 size={16} className="text-[#455cab]/30" />
        </div>
        <div className="text-center space-y-1.5">
          <p className="text-sm font-light text-[#455cab]/60">
            Nenhum dado Google Ads disponível
          </p>
          <p className="text-xs text-[#171f38]/45 font-light max-w-xs leading-relaxed">
            Mapeie uma conta Google Ads em Admin → Integrações e sincronize os dados.
          </p>
        </div>
      </div>
    );
  }

  const s    = performance.summary;
  const rows = performance.rows;

  const spend       = typeof s.spend       === "number" ? s.spend       : null;
  const impressions = typeof s.impressions === "number" ? s.impressions : null;
  const clicks      = typeof s.clicks      === "number" ? s.clicks      : null;
  const cpc         = typeof s.cpc         === "number" ? s.cpc         : null;
  const ctr         = typeof s.ctr         === "number" ? s.ctr         : null;
  const conversions = typeof s.leads       === "number" ? s.leads       : null;
  const hasConversions = conversions !== null && conversions > 0;
  const costPerConversion =
    hasConversions && spend !== null ? spend / conversions! : null;

  return (
    <div className="space-y-5">
      {/* ── Cabeçalho + filtro de período ───────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h3 className="text-sm font-light text-[#455cab] tracking-wide">
          Visão geral de performance
        </h3>
        <PeriodFilter
          period={period}
          customStart={customStart}
          customEnd={customEnd}
          onChange={handlePeriodChange}
        />
      </div>

      {/* ── KPIs ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-7 gap-3">
        <KpiCard
          label="Investimento"
          value={spend !== null ? fmtCurrency(spend) : null}
          rows={rows}
          sparkKey="spend"
          sparkColor="#fb251d"
        />
        <KpiCard
          label="Conversões"
          value={hasConversions ? fmtNum(conversions!) : null}
          pending={!hasConversions}
          rows={rows}
          sparkKey={hasConversions ? "leads" : undefined}
          sparkColor="#28b52e"
        />
        <KpiCard
          label="Custo / Conv."
          value={costPerConversion !== null ? fmtCurrency(costPerConversion) : null}
          pending={!hasConversions}
          rows={rows}
          sparkKey={hasConversions ? "cost_per_lead" : undefined}
          sparkColor="#7b27fa"
        />
        <KpiCard
          label="Cliques"
          value={clicks !== null ? fmtNum(clicks) : null}
          rows={rows}
          sparkKey="clicks"
          sparkColor="#0b72fb"
        />
        <KpiCard
          label="Impressões"
          value={impressions !== null ? fmtNum(impressions) : null}
          rows={rows}
          sparkKey="impressions"
          sparkColor="#fdce21"
        />
        <KpiCard
          label="CPC"
          value={cpc !== null ? fmtCurrency(cpc) : null}
          rows={rows}
          sparkKey="cpc"
          sparkColor="#f43f5e"
        />
        <KpiCard
          label="CTR"
          value={ctr !== null ? fmtPct(ctr) : null}
          rows={rows}
          sparkKey="ctr"
          sparkColor="#f97316"
        />
      </div>

      {/* ── Divisor ─────────────────────────────────────────────── */}
      <div className="border-t border-[#dfdedf]" />

      {/* ── Gráfico de evolução ──────────────────────────────────── */}
      <EvolutionChart rows={rows} hasConversions={hasConversions} />

    </div>
  );
}

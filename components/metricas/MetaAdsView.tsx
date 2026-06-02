"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, ChevronDown, BarChart3, Film } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type {
  BlockWithMetrics,
  PerformanceData,
  PerformanceRow,
  PerformanceSummary,
} from "@/types";
import type { CreativeRow } from "@/lib/data/performance";
import type { RegionRow, DemographicRow } from "@/lib/data/performance-breakdowns";
import { RegionHeatmap } from "./RegionHeatmap";

// ── Opções do filtro de período ───────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { value: "today", label: "Hoje" },
  { value: "yesterday", label: "Ontem" },
  { value: "last_7_days", label: "Últimos 7 dias" },
  { value: "last_14_days", label: "Últimos 14 dias" },
  { value: "last_30_days", label: "Últimos 30 dias" },
  { value: "this_month", label: "Este mês" },
  { value: "last_month", label: "Mês passado" },
  { value: "custom", label: "Personalizado" },
];

// ── Definições das métricas disponíveis no gráfico de evolução ───────────────

interface EvoMetricDef {
  label: string;
  color: string;
  format: "currency_brl" | "integer" | "decimal" | "percentage";
  axis: "left" | "right";
}

const EVOLUTION_METRIC_DEFS: Record<string, EvoMetricDef> = {
  spend:            { label: "Investimento",    color: "#28b52e", format: "currency_brl", axis: "left"  },
  impressions:      { label: "Impressões",      color: "#fdce21", format: "integer",      axis: "right" },
  reach:            { label: "Alcance",         color: "#7b27fa", format: "integer",      axis: "right" },
  clicks:           { label: "Cliques",         color: "#0b72fb", format: "integer",      axis: "right" },
  messages_started: { label: "Mensagens",       color: "#0b72fb", format: "integer",      axis: "right" },
  leads:            { label: "Leads",           color: "#28b52e", format: "integer",      axis: "right" },
  frequency:        { label: "Frequência",      color: "#455cab", format: "decimal",      axis: "right" },
  ctr:              { label: "CTR",             color: "#638acc", format: "percentage",   axis: "right" },
  cpc:              { label: "CPC",             color: "#fb251d", format: "currency_brl", axis: "left"  },
  cpm:              { label: "CPM",             color: "#171f38", format: "currency_brl", axis: "left"  },
  purchases:        { label: "Compras",         color: "#28b52e", format: "integer",      axis: "right" },
  purchase_value:   { label: "Valor de compra", color: "#455cab", format: "currency_brl", axis: "left"  },
  cost_per_lead:    { label: "CPL",             color: "#fb251d", format: "currency_brl", axis: "left"  },
};

// ── Formatação ────────────────────────────────────────────────────────────────

function formatValue(value: number, format: string): string {
  switch (format) {
    case "currency_brl":
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
    case "percentage":
      return `${value.toFixed(2)}%`;
    case "decimal":
      return value.toFixed(2);
    case "integer":
      return new Intl.NumberFormat("pt-BR").format(Math.round(value));
    default:
      return new Intl.NumberFormat("pt-BR").format(Math.round(value));
  }
}

function fmtSummaryVal(
  summary: PerformanceSummary | null,
  key: string,
  format: string
): string {
  const raw = summary?.[key];
  if (typeof raw !== "number") return "—";
  return formatValue(raw, format);
}

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

// ── Filtro de período ─────────────────────────────────────────────────────────

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
        <div className="absolute top-full mt-2 right-0 z-50 min-w-[210px] rounded-xl border border-slate-200 bg-white shadow-xl shadow-black/[0.08] overflow-hidden">
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
                  ? "text-vitti-blue bg-vitti-blue/[0.10]"
                  : "text-vitti-blue/60 hover:text-vitti-blue hover:bg-vitti-blue/[0.06]"
              )}
            >
              {opt.label}
            </button>
          ))}

          {period === "custom" && (
            <div className="border-t border-slate-200/60 px-4 py-3 space-y-2 bg-slate-50/60">
              <p className="text-[9px] text-vitti-blue/40 tracking-[0.1em] uppercase font-light">
                Período personalizado
              </p>
              <input
                type="date"
                value={customStart}
                max={customEnd || undefined}
                onChange={(e) => onChange("custom", e.target.value, customEnd)}
                className="w-full bg-slate-100/60 border border-slate-200 rounded-lg px-3 py-2 text-[11px] text-vitti-blue/60 font-light focus:outline-none focus:border-vitti-blue/40 transition-colors [color-scheme:light]"
              />
              <input
                type="date"
                value={customEnd}
                min={customStart || undefined}
                onChange={(e) => onChange("custom", customStart, e.target.value)}
                className="w-full bg-slate-100/60 border border-slate-200 rounded-lg px-3 py-2 text-[11px] text-vitti-blue/60 font-light focus:outline-none focus:border-vitti-blue/40 transition-colors [color-scheme:light]"
              />
              {customStart && customEnd && (
                <button
                  onClick={() => setOpen(false)}
                  className="w-full py-2 rounded-lg bg-vitti-blue/[0.15] border border-vitti-blue/20 text-[11px] text-vitti-blue font-light hover:bg-vitti-blue/[0.22] transition-colors"
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

// ── Sparkline (mini gráficos dos 5 cards superiores) ─────────────────────────

function Sparkline({
  data,
  dataKey,
  color,
}: {
  data: PerformanceRow[];
  dataKey: keyof PerformanceRow;
  color: string;
}) {
  if (data.length < 2) return <div className="h-10" />;
  const gradientId = `sg_${color.replace("#", "")}`;
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
          dataKey={dataKey as string}
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

// ── KPI card fixo (5 cards superiores) ───────────────────────────────────────

interface KpiDef {
  key: keyof PerformanceRow;
  label: string;
  format: string;
  sparkColor: string;
}

function FixedKpiCard({
  kpi,
  summary,
  rows,
}: {
  kpi: KpiDef;
  summary: PerformanceSummary | null;
  rows: PerformanceRow[];
}) {
  const raw = summary?.[kpi.key as string];
  const value = typeof raw === "number" ? raw : null;
  const hasData = value !== null;

  return (
    <div className="rounded-2xl border border-white bg-white/60 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] pt-4 px-4 pb-0 flex flex-col gap-1 min-w-0 overflow-hidden">
      <p className="text-[11px] text-[#171f38] font-light tracking-wide truncate">
        {kpi.label}
      </p>
      <p
        className={cn(
          "text-xl font-bold tabular-nums leading-none mt-0.5",
          hasData ? "text-[#455cab]" : "text-[#455cab]/30"
        )}
      >
        {hasData ? formatValue(value!, kpi.format) : "—"}
      </p>
      <div className="-mx-4 mt-2">
        <Sparkline data={rows} dataKey={kpi.key} color={kpi.sparkColor} />
      </div>
    </div>
  );
}

// ── Funil de resultados (SVG) ─────────────────────────────────────────────────

function FunnelChart({
  summary,
  isLeads,
}: {
  summary: PerformanceSummary | null;
  isLeads: boolean;
}) {
  const convKey = isLeads ? "leads" : "messages_started";
  const convLabel = isLeads ? "Leads" : "Mensagens";

  function fmt(key: string): string {
    const raw = summary?.[key];
    if (typeof raw !== "number") return "—";
    return new Intl.NumberFormat("pt-BR").format(Math.round(raw));
  }

  const stages = [
    { key: "impressions", label: "Impressões", color: "#2d5f92" },
    { key: "reach",       label: "Alcance",    color: "#4a88be" },
    { key: "clicks",      label: "Cliques",    color: "#7470b6" },
    { key: convKey,       label: convLabel,    color: "#8aacd8" },
  ];

  // viewBox: 200 units wide. 5 boundary levels define the 4 trapezoids.
  // Top (level 0) is nearly full width; bottom (level 4) stays wide enough for readability.
  const W = 200;
  const SH = 58; // height per stage in SVG units
  const levels: [number, number][] = [
    [1,  199], // top of stage 1
    [18, 182], // boundary 1→2
    [33, 167], // boundary 2→3
    [47, 153], // boundary 3→4
    [59, 141], // bottom of stage 4
  ];
  const totalH = SH * stages.length;
  const cx = W / 2;

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${W} ${totalH}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: "block" }}
    >
      {stages.map((stage, i) => {
        const y = i * SH;
        const [lTop, rTop] = levels[i];
        const [lBot, rBot] = levels[i + 1];
        const d = `M ${lTop} ${y} L ${rTop} ${y} L ${rBot} ${y + SH} L ${lBot} ${y + SH} Z`;
        const cy = y + SH / 2;
        const valStr = fmt(stage.key);
        // pill width: 6.8 units per char, minimum 32
        const pillW = Math.max(valStr.length * 6.8, 32);

        return (
          <g key={stage.key}>
            {/* trapezoid — stroke matches card bg to create clean stage separator */}
            <path d={d} fill={stage.color} stroke="#f1f1f1" strokeWidth="1.5" />
            {/* metric name */}
            <text
              x={cx} y={cy - 11}
              textAnchor="middle" dominantBaseline="middle"
              fill="rgba(255,255,255,0.82)"
              fontSize="7" fontWeight="300" letterSpacing="1.5"
            >
              {stage.label.toUpperCase()}
            </text>
            {/* value pill */}
            <rect
              x={cx - pillW / 2} y={cy + 1}
              width={pillW} height={14}
              rx={4}
              fill="rgba(255,255,255,0.52)"
            />
            <text
              x={cx} y={cy + 8}
              textAnchor="middle" dominantBaseline="middle"
              fill="#455cab"
              fontSize="10" fontWeight="700"
            >
              {valStr}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Card KPI pequeno (coluna lateral) ─────────────────────────────────────────

function SmallKpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white bg-white/60 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] px-3 py-2.5 flex flex-col gap-0.5">
      <p className="text-[9px] text-[#171f38] font-light tracking-wide truncate">{label}</p>
      <p className="text-sm font-bold text-[#455cab] tabular-nums leading-tight">{value}</p>
    </div>
  );
}

// ── Gráfico de evolução — tooltip e chart dinâmicos ──────────────────────────

function EvolutionTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const parts = String(label ?? "").split("-");
  const dl =
    parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : String(label ?? "");
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-lg px-3 py-2.5 space-y-1.5 min-w-[148px]">
      <p className="text-[9px] text-[#171f38]/50 font-light">{dl}</p>
      {payload.map((p) => {
        const def = EVOLUTION_METRIC_DEFS[p.name];
        return (
          <div key={p.name} className="flex items-center justify-between gap-3">
            <span className="text-[9px] text-[#171f38]/60 font-light">
              {def?.label ?? p.name}
            </span>
            <span className="text-[10px] font-bold tabular-nums" style={{ color: p.color }}>
              {formatValue(Number(p.value), def?.format ?? "integer")}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function EvolutionChart({
  rows,
  metricKeys,
}: {
  rows: PerformanceRow[];
  metricKeys: string[];
}) {
  // Cores fixas por posição: 1 série → roxo, 2 → +vermelho, 3 → +verde
  const PALETTE = ["#7b27fa", "#fb251d", "#28b52e"];

  const activeMetrics = metricKeys
    .filter((k) => k in EVOLUTION_METRIC_DEFS)
    .map((k, i) => ({
      key: k,
      def: EVOLUTION_METRIC_DEFS[k],
      color: PALETTE[i] ?? PALETTE[0],
    }));

  if (rows.length === 0 || activeMetrics.length === 0) {
    return (
      <div className="flex-1 min-h-[160px] flex flex-col items-center justify-center gap-2">
        <BarChart3 size={16} className="text-[#171f38]/20" />
        <p className="text-[10px] text-[#171f38]/30 font-light">
          Aguardando sincronização
        </p>
      </div>
    );
  }

  const hasLeft = activeMetrics.some((m) => m.def.axis === "left");
  const hasRight = activeMetrics.some((m) => m.def.axis === "right");
  const useDualAxis = hasLeft && hasRight;

  const getAxisId = (key: string): "left" | "right" => {
    if (!useDualAxis) return "left";
    return EVOLUTION_METRIC_DEFS[key]?.axis ?? "right";
  };

  const fmtDate = (iso: string) => {
    const p = iso.split("-");
    return `${p[2]}/${p[1]}`;
  };

  const fmtCurrency = (v: number) =>
    v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${Math.round(v)}`;

  const fmtCount = (v: number) =>
    v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(Math.round(v));

  const fmtLeftTick = fmtCurrency;

  const firstRight = activeMetrics.find((m) => getAxisId(m.key) === "right");
  const fmtRightTick = (v: number) => {
    if (firstRight?.def.format === "percentage") return `${v.toFixed(1)}%`;
    if (firstRight?.def.format === "decimal") return v.toFixed(2);
    return fmtCount(v);
  };

  const firstAny = activeMetrics[0];
  const fmtSingleTick = (v: number) => {
    if (firstAny?.def.format === "currency_brl") return fmtCurrency(v);
    if (firstAny?.def.format === "percentage") return `${v.toFixed(1)}%`;
    if (firstAny?.def.format === "decimal") return v.toFixed(2);
    return fmtCount(v);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Legenda dinâmica */}
      <div className="flex flex-wrap gap-4 mb-3">
        {activeMetrics.map(({ key, def, color }) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className="w-3 h-[2px] rounded" style={{ backgroundColor: color }} />
            <span className="text-[9px] text-[#171f38]/55 font-light">{def.label}</span>
          </div>
        ))}
      </div>
      <div className="flex-1 min-h-[160px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={rows}
          margin={{ top: 4, right: useDualAxis ? 8 : 4, bottom: 4, left: 0 }}
        >
          <defs>
            {activeMetrics.map(({ key, color }) => (
              <linearGradient key={key} id={`evoGrad_${key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.18} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} stroke="rgba(0,0,0,0.05)" />
          <XAxis
            dataKey="date"
            tickFormatter={fmtDate}
            tick={{ fill: "#171f38", fontSize: 8, fontWeight: 300 }}
            axisLine={false}
            tickLine={false}
            dy={4}
          />
          <YAxis
            yAxisId="left"
            tickFormatter={useDualAxis ? fmtLeftTick : fmtSingleTick}
            tick={{ fill: "rgba(0,0,0,0.22)", fontSize: 7, fontWeight: 300 }}
            axisLine={false}
            tickLine={false}
            width={38}
          />
          {useDualAxis && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tickFormatter={fmtRightTick}
              tick={{ fill: "rgba(0,0,0,0.22)", fontSize: 7, fontWeight: 300 }}
              axisLine={false}
              tickLine={false}
              width={26}
            />
          )}
          <Tooltip
            content={<EvolutionTooltip />}
            cursor={{ stroke: "rgba(0,0,0,0.06)", strokeWidth: 1 }}
          />
          {activeMetrics.map(({ key, color }) => (
            <Area
              key={key}
              yAxisId={getAxisId(key)}
              type="monotone"
              dataKey={key}
              stroke={color}
              strokeWidth={1.5}
              fill={`url(#evoGrad_${key})`}
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

// ── Helpers demográficos ──────────────────────────────────────────────────────

interface DonutSlice {
  label: string;
  value: number; // percentual 0–100
  color: string;
}

const GENDER_COLORS: Record<string, string> = {
  female: "#f472b6", feminino: "#f472b6",
  male:   "#60a5fa", masculino: "#60a5fa",
};
function genderColor(v: string): string {
  return GENDER_COLORS[v.toLowerCase()] ?? "#9ca3af";
}
function genderLabel(v: string): string {
  const l = v.toLowerCase();
  if (l === "female" || l === "feminino") return "Feminino";
  if (l === "male"   || l === "masculino") return "Masculino";
  return "Outros";
}

const AGE_ORDER = ["13-17", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"];
const AGE_COLORS = ["#bfdbfe", "#93c5fd", "#60a5fa", "#3b82f6", "#6366f1", "#8b5cf6", "#a78bfa"];
function ageColor(v: string): string {
  const i = AGE_ORDER.indexOf(v);
  return AGE_COLORS[i >= 0 ? i : AGE_COLORS.length - 1];
}

function buildDemographicSlices(
  rows: DemographicRow[],
  type: "gender" | "age"
): { slices: DonutSlice[]; metricLabel: string } | null {
  const filtered = rows.filter((r) => r.breakdownType === type);
  if (filtered.length === 0) return null;

  const sumLeads       = filtered.reduce((s, r) => s + r.leads, 0);
  const sumImpressions = filtered.reduce((s, r) => s + r.impressions, 0);
  const sumReach       = filtered.reduce((s, r) => s + r.reach, 0);

  let key: "leads" | "impressions" | "reach" | "spend";
  let metricLabel: string;
  if (sumLeads > 0)       { key = "leads";       metricLabel = "leads"; }
  else if (sumImpressions > 0) { key = "impressions"; metricLabel = "impressões"; }
  else if (sumReach > 0)  { key = "reach";       metricLabel = "alcance"; }
  else                    { key = "spend";       metricLabel = "investimento"; }

  const total = filtered.reduce((s, r) => s + r[key], 0);
  if (total === 0) return null;

  const colorFn = type === "gender" ? genderColor : ageColor;
  const labelFn = type === "gender" ? genderLabel : (v: string) => v;

  const slices: DonutSlice[] = filtered
    .map((r) => ({
      label: labelFn(r.breakdownValue),
      value: (r[key] / total) * 100,
      color: colorFn(r.breakdownValue),
    }))
    .sort((a, b) => {
      if (type === "age") {
        const ai = AGE_ORDER.indexOf(a.label);
        const bi = AGE_ORDER.indexOf(b.label);
        if (ai >= 0 && bi >= 0) return ai - bi;
      }
      return b.value - a.value;
    });

  return { slices, metricLabel };
}

// ── DonutCard ─────────────────────────────────────────────────────────────────

function DonutCard({
  title,
  className,
  slices,
  metricLabel,
}: {
  title: string;
  className?: string;
  slices?: DonutSlice[] | null;
  metricLabel?: string;
}) {
  const hasData = slices && slices.length > 0;
  const maxVal  = hasData ? Math.max(...slices!.map((s) => s.value)) : 0;

  return (
    <div className={cn("rounded-2xl border border-white bg-white/60 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] p-4 flex flex-col", className)}>
      <div className="flex items-center justify-between mb-2">
        <h5 className="text-[11px] font-light text-[#455cab] tracking-wide">{title}</h5>
        {hasData && metricLabel && (
          <span className="text-[8px] text-[#455cab]/40 font-light uppercase tracking-wider">
            {metricLabel}
          </span>
        )}
      </div>
      <div className="flex-1 flex flex-col justify-center">
        {hasData ? (
          <div className="flex flex-col gap-[6px]">
            {slices!.map((s) => (
              <div key={s.label}>
                <div className="flex items-center justify-between gap-1 mb-[3px]">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="text-[9px] text-[#171f38]/65 font-light">{s.label}</span>
                  </div>
                  <span className="text-[9px] text-[#171f38]/70 font-light tabular-nums">
                    {s.value.toFixed(1)}%
                  </span>
                </div>
                <div className="h-[2px] rounded-full bg-[#455cab]/[0.08] overflow-hidden ml-3.5">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${maxVal > 0 ? (s.value / maxVal) * 100 : 0}%`,
                      backgroundColor: s.color,
                      opacity: 0.65,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[9px] text-[#171f38]/30 font-light text-center leading-relaxed">
            Sem dados
            <br />
            no período
          </p>
        )}
      </div>
    </div>
  );
}

// ── Melhores anúncios ─────────────────────────────────────────────────────────

function HoverMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[7px] text-white/45 font-light tracking-wide">{label}</span>
      <span className="text-[10px] text-white font-bold tabular-nums leading-none">{value}</span>
    </div>
  );
}

function CreativeThumb({ url, name }: { url: string | null; name: string | null }) {
  if (!url) {
    return (
      <div className="w-full h-44 bg-[#e4e8f2] flex items-center justify-center px-3">
        <p className="text-[9px] text-[#455cab]/50 font-light text-center leading-relaxed line-clamp-3">
          {name ?? "Criativo"}
        </p>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={name ?? ""} className="w-full h-44 object-cover" />
  );
}

// Decide a métrica de resultado por criativo:
// leads têm prioridade sobre mensagens — respeita o objetivo real da campanha.
function resolveCreativeResult(c: CreativeRow): {
  value: number;
  label: string;
  cost: number | null;
  costLabel: string;
} {
  if (c.leads > 0) {
    return {
      value: c.leads,
      label: "Leads",
      cost: c.cost_per_lead,
      costLabel: "Custo / Lead",
    };
  }
  return {
    value: c.messages_started,
    label: "Mensagens",
    cost: c.cost_per_message,
    costLabel: "Custo / Mensagem",
  };
}

function BestAdsSection({ creatives }: { creatives: CreativeRow[] }) {
  const sorted = [...creatives]
    .filter((c) => c.spend > 0 || c.impressions > 0 || c.leads > 0 || c.messages_started > 0)
    .sort((a, b) => {
      // Campanhas com leads ficam acima das de mensagens; desempate por spend
      const aResult = a.leads > 0 ? a.leads : 0;
      const bResult = b.leads > 0 ? b.leads : 0;
      if (bResult !== aResult) return bResult - aResult;
      if (b.messages_started !== a.messages_started) return b.messages_started - a.messages_started;
      return b.spend - a.spend;
    });

  if (sorted.length === 0) {
    return (
      <div className="rounded-2xl border border-white bg-white/60 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] p-4 flex flex-col min-h-[268px]">
        <h4 className="text-[11px] font-light text-[#455cab] tracking-wide mb-auto">
          Melhores anúncios
        </h4>
        <div className="flex-1 flex flex-col items-center justify-center gap-2">
          <Film size={16} className="text-[#455cab]/20" />
          <p className="text-[10px] text-[#171f38]/30 font-light text-center leading-relaxed">
            Aguardando sincronização
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white bg-white/60 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] p-4 flex flex-col gap-3">
      <h4 className="text-[11px] font-light text-[#455cab] tracking-wide">
        Melhores anúncios
      </h4>
      {/* Carrossel horizontal: 4 cards visíveis por vez em desktop, scroll suave para mais */}
      <div className="relative">
        <div className="flex gap-3 overflow-x-auto pb-2 -mb-2 scroll-smooth snap-x snap-mandatory">
          {sorted.map((c) => {
            const result = resolveCreativeResult(c);
            return (
              <div
                key={c.adId}
                className="relative group shrink-0 w-[calc(25%-9px)] snap-start rounded-xl border border-slate-200 bg-white overflow-hidden"
              >
                <CreativeThumb url={c.thumbnail_url} name={c.adName ?? c.campaignName} />
                <div className="px-2.5 py-2 bg-white">
                  <p className="text-[8px] text-[#171f38] font-light truncate leading-tight">
                    {c.adName ?? c.campaignName ?? "—"}
                  </p>
                </div>
                {/* Overlay de hover */}
                <div className="absolute inset-0 bg-[#0f1626]/[0.88] opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-center px-3.5 gap-3">
                  <HoverMetric label="Investimento" value={formatValue(c.spend, "currency_brl")} />
                  <HoverMetric label={result.label} value={formatValue(result.value, "integer")} />
                  <HoverMetric
                    label={result.costLabel}
                    value={result.cost != null ? formatValue(result.cost, "currency_brl") : "—"}
                  />
                </div>
              </div>
            );
          })}
        </div>
        {sorted.length > 4 && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[#f1f1f1] via-[#f1f1f1]/70 to-transparent"
          />
        )}
      </div>
    </div>
  );
}

// ── MetaAdsView ───────────────────────────────────────────────────────────────

interface MetaAdsViewProps {
  blocks: BlockWithMetrics[];
  performance?: PerformanceData | null;
  creatives?: CreativeRow[] | null;
  regionBreakdown?: RegionRow[] | null;
  demographicBreakdown?: DemographicRow[] | null;
  initialPeriod?: string;
  initialStartDate?: string;
  initialEndDate?: string;
}

export function MetaAdsView({
  blocks,
  performance,
  creatives,
  regionBreakdown,
  demographicBreakdown,
  initialPeriod = "last_7_days",
  initialStartDate = "",
  initialEndDate = "",
}: MetaAdsViewProps) {
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

  const summary = performance?.summary ?? null;
  const rows = performance?.rows ?? [];

  // Lógica de conversão: admin pode fixar "leads" ou "messages"; se não configurado, detecta pelos dados
  const adminConvMetric = (() => {
    for (const { block } of blocks) {
      const m = (block.settings as Record<string, unknown> | null)?.conversion_metric;
      if (m === "leads" || m === "messages") return m as "leads" | "messages";
    }
    return null;
  })();

  const isLeads =
    adminConvMetric === "leads" ||
    (adminConvMetric !== "messages" &&
      typeof summary?.leads === "number" &&
      (summary.leads as number) > 0);

  // Lê métricas do gráfico de evolução configuradas no Admin (salvas em block.settings)
  const configuredEvolutionKeys = (() => {
    for (const { block } of blocks) {
      const s = block.settings as Record<string, unknown> | null;
      const keys = s?.evolution_metrics;
      if (Array.isArray(keys) && keys.length > 0) {
        return (keys as unknown[]).filter(
          (k): k is string => typeof k === "string" && k in EVOLUTION_METRIC_DEFS
        );
      }
    }
    return null;
  })();

  const evolutionMetricKeys: string[] = configuredEvolutionKeys ?? [
    "spend",
    isLeads ? "leads" : "messages_started",
  ];

  const KPIS: KpiDef[] = [
    { key: "spend", label: "Investimento", format: "currency_brl", sparkColor: "#fb251d" },
    {
      key: isLeads ? "leads" : "messages_started",
      label: isLeads ? "Leads" : "Mensagens",
      format: "integer",
      sparkColor: "#28b52e",
    },
    { key: "clicks", label: "Cliques", format: "integer", sparkColor: "#0b72fb" },
    { key: "reach", label: "Alcance", format: "integer", sparkColor: "#7b27fa" },
    { key: "impressions", label: "Impressões", format: "integer", sparkColor: "#fdce21" },
  ];

  return (
    <div className="space-y-5">
      {/* ── Header + 5 cards: grupo compacto ────────────────────── */}
      <div className="space-y-4">
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

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {KPIS.map((kpi) => (
            <FixedKpiCard
              key={kpi.key as string}
              kpi={kpi}
              summary={summary}
              rows={rows}
            />
          ))}
        </div>
      </div>

      {/* ── Divisor ─────────────────────────────────────────────── */}
      <div className="border-t border-slate-200/60" />

      {/* ── Área inferior: 4 colunas ─────────────────────────────
          Desktop (xl): funil | cards | gráfico | donuts
          items-stretch alinha a base de todos os blocos
          Mobile: empilhado
      ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(270px,1.25fr)_minmax(128px,0.6fr)_minmax(400px,2.5fr)_minmax(200px,1fr)] gap-3 items-stretch">

        {/* Coluna 1 — Funil de resultados */}
        <div className="rounded-2xl border border-white bg-white/60 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] p-4 flex flex-col">
          <h4 className="text-[13px] font-semibold text-[#455cab] tracking-wide mb-5 text-center">
            Funil de resultados
          </h4>
          <div className="flex-1 flex items-center justify-center">
            <FunnelChart summary={summary} isLeads={isLeads} />
          </div>
        </div>

        {/* Coluna 2 — KPI cards pequenos */}
        <div className="flex flex-col justify-between gap-2">
          <SmallKpiCard
            label="Frequência"
            value={fmtSummaryVal(summary, "frequency", "decimal")}
          />
          <SmallKpiCard
            label="CTR"
            value={fmtSummaryVal(summary, "ctr", "percentage")}
          />
          <SmallKpiCard
            label="CPM"
            value={fmtSummaryVal(summary, "cpm", "currency_brl")}
          />
          <SmallKpiCard
            label="CPC"
            value={fmtSummaryVal(summary, "cpc", "currency_brl")}
          />
          <SmallKpiCard
            label={isLeads ? "CPL" : "CP Mensagem"}
            value={fmtSummaryVal(
              summary,
              isLeads ? "cost_per_lead" : "cost_per_message",
              "currency_brl"
            )}
          />
        </div>

        {/* Coluna 3 — Gráfico de evolução */}
        <div className="rounded-2xl border border-white bg-white/60 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] p-4 flex flex-col">
          <h4 className="text-[11px] font-light text-[#455cab] tracking-wide mb-1">
            Evolução no período
          </h4>
          <EvolutionChart rows={rows} metricKeys={evolutionMetricKeys} />
        </div>

        {/* Coluna 4 — Gênero e Faixa etária */}
        {(() => {
          const demo = demographicBreakdown ?? [];
          const gender = buildDemographicSlices(demo, "gender");
          const age    = buildDemographicSlices(demo, "age");
          return (
            <div className="flex flex-col gap-3">
              <DonutCard
                title="Percentual de Gênero"
                className="flex-1"
                slices={gender?.slices}
                metricLabel={gender?.metricLabel}
              />
              <DonutCard
                title="Faixa etária"
                className="flex-1"
                slices={age?.slices}
                metricLabel={age?.metricLabel}
              />
            </div>
          );
        })()}
      </div>

      {/* ── Seção: Melhores anúncios + Mapa de calor por região ──
          Usa o mesmo grid de 4 colunas da seção superior para alinhar a coluna
          do Mapa de calor com os cards de Gênero e Faixa etária.
          Melhores anúncios ocupa as 3 primeiras colunas (xl:col-span-3).
          Última coluna levemente mais larga que a seção superior (280px vs 200px).
      ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(240px,1.05fr)_minmax(110px,0.5fr)_minmax(360px,2.1fr)_minmax(280px,1.15fr)] gap-3">
        <div className="xl:col-span-3">
          <BestAdsSection creatives={creatives ?? []} />
        </div>
        <RegionHeatmap rows={regionBreakdown ?? []} isLeads={isLeads} />
      </div>
    </div>
  );
}

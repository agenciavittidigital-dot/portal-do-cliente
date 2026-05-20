"use client";

import { useEffect, useRef, useState } from "react";
import { BarChart3, Calendar, ChevronDown, Filter, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BlockMetric, BlockWithMetrics } from "@/types";

// ── Opções dos filtros ────────────────────────────────────────────────────────

const VIEW_OPTIONS = [
  { value: "campaign", label: "Campanha" },
  { value: "adset", label: "Conjunto de anúncios" },
  { value: "ad", label: "Anúncio" },
];

const ANALYSIS_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "ads", label: "Anúncios" },
  { value: "creatives", label: "Criativos" },
  { value: "audiences", label: "Públicos" },
  { value: "placements", label: "Posicionamentos" },
];

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function unitPlaceholder(unit: string | null): string {
  if (unit === "percentage") return "—%";
  if (unit === "currency") return "R$ —";
  return "—";
}

function findBlock(blocks: BlockWithMetrics[], fragment: string): BlockWithMetrics | undefined {
  const lower = fragment.toLowerCase();
  return blocks.find((b) => b.block.title?.toLowerCase().includes(lower));
}

function kpiGridCols(count: number): string {
  if (count >= 4) return "grid-cols-2 md:grid-cols-4";
  if (count === 3) return "grid-cols-3";
  if (count === 2) return "grid-cols-2";
  return "grid-cols-1";
}

function updateUrlParams(params: Record<string, string>) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  window.history.replaceState({}, "", url.toString());
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

// ── Dropdown genérico ─────────────────────────────────────────────────────────

function FilterDropdown({
  icon: Icon,
  options,
  value,
  onChange,
}: {
  icon: React.ElementType;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const currentLabel = options.find((o) => o.value === value)?.label ?? options[0]?.label ?? "";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-light transition-all duration-150 select-none",
          open
            ? "border-vitti-blue/30 text-vitti-light/80 bg-vitti-blue/[0.08]"
            : "border-white/[0.07] text-white/30 hover:border-white/[0.15] hover:text-white/50"
        )}
      >
        <Icon size={9} className="shrink-0" />
        <span className="max-w-[130px] truncate">{currentLabel}</span>
        <ChevronDown
          size={8}
          className={cn("shrink-0 transition-transform duration-150", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="absolute top-full mt-2 right-0 z-50 min-w-[180px] rounded-xl border border-white/[0.07] bg-vitti-dark shadow-2xl shadow-black/80 overflow-hidden">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={cn(
                "w-full text-left px-4 py-2.5 text-[11px] font-light transition-colors",
                value === opt.value
                  ? "text-vitti-light bg-vitti-blue/[0.14]"
                  : "text-white/35 hover:text-white/65 hover:bg-white/[0.04]"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
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
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const label = resolvePeriodLabel(period, customStart, customEnd);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-light transition-all duration-150 select-none",
          open
            ? "border-vitti-blue/30 text-vitti-light/80 bg-vitti-blue/[0.08]"
            : "border-white/[0.07] text-white/30 hover:border-white/[0.15] hover:text-white/50"
        )}
      >
        <Calendar size={9} className="shrink-0" />
        <span className="max-w-[160px] truncate">{label}</span>
        <ChevronDown
          size={8}
          className={cn("shrink-0 transition-transform duration-150", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="absolute top-full mt-2 right-0 z-50 min-w-[210px] rounded-xl border border-white/[0.07] bg-vitti-dark shadow-2xl shadow-black/80 overflow-hidden">
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
                  ? "text-vitti-light bg-vitti-blue/[0.14]"
                  : "text-white/35 hover:text-white/65 hover:bg-white/[0.04]"
              )}
            >
              {opt.label}
            </button>
          ))}

          {period === "custom" && (
            <div className="border-t border-white/[0.05] px-4 py-3 space-y-2 bg-white/[0.01]">
              <p className="text-[9px] text-white/20 tracking-[0.1em] uppercase font-light">
                Período personalizado
              </p>
              <input
                type="date"
                value={customStart}
                max={customEnd || undefined}
                onChange={(e) => onChange("custom", e.target.value, customEnd)}
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-[11px] text-white/50 font-light focus:outline-none focus:border-vitti-blue/40 transition-colors [color-scheme:dark]"
              />
              <input
                type="date"
                value={customEnd}
                min={customStart || undefined}
                onChange={(e) => onChange("custom", customStart, e.target.value)}
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-[11px] text-white/50 font-light focus:outline-none focus:border-vitti-blue/40 transition-colors [color-scheme:dark]"
              />
              {customStart && customEnd && (
                <button
                  onClick={() => setOpen(false)}
                  className="w-full py-2 rounded-lg bg-vitti-blue/[0.15] border border-vitti-blue/20 text-[11px] text-vitti-light/70 font-light hover:bg-vitti-blue/[0.22] transition-colors"
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

// ── KPI cards ─────────────────────────────────────────────────────────────────

function KpiCard({ metric }: { metric: BlockMetric }) {
  const name = metric.display_name ?? metric.catalog?.name ?? "Métrica";
  const unit = metric.catalog?.unit ?? null;
  return (
    <div className="bg-white/[0.02] rounded-xl border border-white/5 p-4 flex flex-col gap-2">
      <p className="text-[9px] text-white/25 tracking-[0.15em] uppercase font-light truncate">
        {name}
      </p>
      <p className="text-2xl font-light text-white/20 tabular-nums leading-none mt-1">
        {unitPlaceholder(unit)}
      </p>
      <span className="text-[9px] text-amber-400/40 font-light">Aguardando dados</span>
    </div>
  );
}

function KpiCardSm({ metric }: { metric: BlockMetric }) {
  const name = metric.display_name ?? metric.catalog?.name ?? "Métrica";
  const unit = metric.catalog?.unit ?? null;
  return (
    <div className="bg-white/[0.02] rounded-lg border border-white/5 p-3 flex flex-col gap-1.5">
      <p className="text-[9px] text-white/20 tracking-[0.15em] uppercase font-light truncate">
        {name}
      </p>
      <p className="text-xl font-light text-white/[0.14] tabular-nums leading-none">
        {unitPlaceholder(unit)}
      </p>
      <span className="text-[8px] text-amber-400/30 font-light">Aguardando dados</span>
    </div>
  );
}

// ── Placeholders de conteúdo ──────────────────────────────────────────────────

function EmptyMetrics() {
  return (
    <div className="h-20 flex items-center justify-center rounded-xl border border-dashed border-white/[0.04]">
      <p className="text-[10px] text-white/[0.10] font-light">Sem métricas configuradas</p>
    </div>
  );
}

function ChartAreaPlaceholder() {
  return (
    <div className="relative h-full min-h-[200px] rounded-xl border border-white/[0.06] bg-white/[0.01] overflow-hidden flex flex-col items-center justify-center gap-2">
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 400 200"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="metaAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#638ACC" stopOpacity="0.07" />
            <stop offset="100%" stopColor="#638ACC" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[50, 100, 150].map((y) => (
          <line
            key={y}
            x1="0"
            y1={y}
            x2="400"
            y2={y}
            stroke="white"
            strokeOpacity="0.03"
            strokeWidth="1"
          />
        ))}
        <path
          d="M0,160 C60,150 100,130 160,118 C220,108 270,82 320,72 C360,65 385,56 400,52 L400,200 L0,200 Z"
          fill="url(#metaAreaGrad)"
        />
        <path
          d="M0,160 C60,150 100,130 160,118 C220,108 270,82 320,72 C360,65 385,56 400,52"
          fill="none"
          stroke="#638ACC"
          strokeOpacity="0.22"
          strokeWidth="1.5"
        />
      </svg>
      <BarChart3 size={16} className="text-white/[0.07] relative z-10" />
      <p className="text-[10px] text-white/[0.10] font-light relative z-10">
        Aguardando sincronização
      </p>
    </div>
  );
}

function TablePlaceholder() {
  const cols = ["Campanha", "Investimento", "Impressões", "Cliques", "CTR", "CPC"];
  const skeleton = [
    [65, 40, 55, 35, 45, 30],
    [80, 55, 45, 50, 35, 40],
    [50, 45, 60, 40, 50, 35],
    [70, 35, 50, 45, 40, 55],
  ];
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.01] overflow-hidden">
      <div className="grid grid-cols-6 border-b border-white/[0.06] px-4 py-2.5 bg-white/[0.02]">
        {cols.map((col) => (
          <p key={col} className="text-[9px] text-white/20 tracking-[0.12em] uppercase font-light">
            {col}
          </p>
        ))}
      </div>
      {skeleton.map((row, i) => (
        <div
          key={i}
          className={cn(
            "grid grid-cols-6 px-4 py-3 gap-x-4",
            i < skeleton.length - 1 && "border-b border-white/[0.03]"
          )}
        >
          {row.map((w, j) => (
            <div key={j} className="h-1.5 rounded-full bg-white/[0.05]" style={{ width: `${w}%` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ── MetaAdsView ───────────────────────────────────────────────────────────────

export function MetaAdsView({ blocks }: { blocks: BlockWithMetrics[] }) {
  const [view, setView] = useState("campaign");
  const [analysis, setAnalysis] = useState("all");
  const [period, setPeriod] = useState("last_7_days");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  function handleViewChange(v: string) {
    setView(v);
    updateUrlParams({ view: v });
  }

  function handleAnalysisChange(v: string) {
    setAnalysis(v);
    updateUrlParams({ analysis: v });
  }

  function handlePeriodChange(p: string, start: string, end: string) {
    setPeriod(p);
    setCustomStart(start);
    setCustomEnd(end);
    const params: Record<string, string> = { period: p };
    if (p === "custom") {
      if (start) params.startDate = start;
      if (end) params.endDate = end;
    }
    updateUrlParams(params);
  }

  const overviewBlock =
    findBlock(blocks, "visão geral") ?? findBlock(blocks, "visao geral");
  const performanceBlock = findBlock(blocks, "performance");
  const conversionsBlock =
    findBlock(blocks, "conversões") ?? findBlock(blocks, "conversoes");

  const mainIds = new Set<string>(
    [overviewBlock?.block.id, performanceBlock?.block.id, conversionsBlock?.block.id].filter(
      (id): id is string => Boolean(id)
    )
  );
  const otherBlocks = blocks.filter((b) => !mainIds.has(b.block.id));

  return (
    <div className="space-y-7">
      {/* ── Header + filtros ────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[9px] text-vitti-light/50 tracking-[0.25em] uppercase font-light mb-1">
            Meta Ads
          </p>
          <h3 className="text-sm font-light text-white/70 tracking-wide">
            Visão geral de performance
          </h3>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <FilterDropdown
            icon={Layers}
            options={VIEW_OPTIONS}
            value={view}
            onChange={handleViewChange}
          />
          <FilterDropdown
            icon={Filter}
            options={ANALYSIS_OPTIONS}
            value={analysis}
            onChange={handleAnalysisChange}
          />
          <PeriodFilter
            period={period}
            customStart={customStart}
            customEnd={customEnd}
            onChange={handlePeriodChange}
          />
        </div>
      </div>

      {/* ── Alcance e entrega (Visão Geral) ─────────────────────── */}
      {overviewBlock && (
        <section>
          <p className="text-[9px] text-white/[0.15] tracking-[0.2em] uppercase font-light mb-3">
            Alcance e entrega
          </p>
          {overviewBlock.metrics.length > 0 ? (
            <div className={cn("grid gap-3", kpiGridCols(overviewBlock.metrics.length))}>
              {overviewBlock.metrics.map((m) => (
                <KpiCard key={m.id} metric={m} />
              ))}
            </div>
          ) : (
            <EmptyMetrics />
          )}
        </section>
      )}

      {/* ── Performance + gráfico ───────────────────────────────── */}
      {performanceBlock && (
        <section>
          <p className="text-[9px] text-white/[0.15] tracking-[0.2em] uppercase font-light mb-3">
            Performance
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex flex-col gap-3">
              {performanceBlock.metrics.length > 0 ? (
                performanceBlock.metrics.map((m) => <KpiCardSm key={m.id} metric={m} />)
              ) : (
                <div className="h-32 flex items-center justify-center rounded-xl border border-dashed border-white/[0.04]">
                  <p className="text-[10px] text-white/[0.10] font-light">Sem métricas</p>
                </div>
              )}
            </div>
            <div className="md:col-span-2">
              <ChartAreaPlaceholder />
            </div>
          </div>
        </section>
      )}

      {/* ── Conversões ──────────────────────────────────────────── */}
      {conversionsBlock && (
        <section>
          <p className="text-[9px] text-white/[0.15] tracking-[0.2em] uppercase font-light mb-3">
            Conversões
          </p>
          {conversionsBlock.metrics.length > 0 ? (
            <div className={cn("grid gap-3", kpiGridCols(conversionsBlock.metrics.length))}>
              {conversionsBlock.metrics.map((m) => (
                <KpiCard key={m.id} metric={m} />
              ))}
            </div>
          ) : (
            <EmptyMetrics />
          )}
        </section>
      )}

      {/* ── Divisor ─────────────────────────────────────────────── */}
      <div className="border-t border-white/[0.04]" />

      {/* ── Análise detalhada (blocos secundários) ──────────────── */}
      {otherBlocks.length > 0 && (
        <section>
          <p className="text-[9px] text-white/[0.12] tracking-[0.2em] uppercase font-light mb-3">
            Análise detalhada
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {otherBlocks.map(({ block, metrics }) => (
              <div
                key={block.id}
                className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-4"
              >
                <p className="text-[9px] text-white/[0.15] tracking-[0.15em] uppercase font-light mb-3">
                  {block.title ?? "Bloco"}
                </p>
                {metrics.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {metrics.map((m) => (
                      <KpiCardSm key={m.id} metric={m} />
                    ))}
                  </div>
                ) : (
                  <div className="h-14 flex items-center justify-center border border-dashed border-white/[0.04] rounded-lg">
                    <p className="text-[10px] text-white/[0.08] font-light">Em breve</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Campanhas ativas ────────────────────────────────────── */}
      <section>
        <p className="text-[9px] text-white/[0.12] tracking-[0.2em] uppercase font-light mb-3">
          Campanhas ativas
        </p>
        <TablePlaceholder />
      </section>
    </div>
  );
}

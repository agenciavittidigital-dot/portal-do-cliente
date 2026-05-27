"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BlockMetric, BlockWithMetrics, PerformanceData, PerformanceSummary } from "@/types";
import { MetaAdsChart } from "./MetaAdsChart";
import { MetaAdsTable } from "./MetaAdsTable";

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

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// Resolve o valor de performance para um metric usando a seguinte prioridade:
// 1. junction.source_field (override específico do bloco)
// 2. catalog.default_source_field (mapeamento padrão no catálogo)
// 3. catalog.key (fallback)
function resolveMetricValue(
  metric: BlockMetric,
  performance: PerformanceSummary | null
): number | null {
  if (!performance) return null;
  const key =
    metric.source_field ??
    metric.catalog?.default_source_field ??
    metric.catalog?.key ??
    null;
  if (!key) return null;
  const val = performance[key];
  return typeof val === "number" ? val : null;
}

function formatValue(value: number, format: string | null): string {
  switch (format) {
    case "currency":
    case "currency_brl":
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
    case "percentage":
      return `${value.toFixed(2)}%`;
    case "integer":
      return new Intl.NumberFormat("pt-BR").format(Math.round(value));
    case "decimal":
      return value.toFixed(2);
    default:
      if (value < 10) return value.toFixed(2);
      return new Intl.NumberFormat("pt-BR").format(Math.round(value));
  }
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

// ── Filtro de período (com refetch via router) ────────────────────────────────

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

function KpiCard({
  metric,
  performance,
}: {
  metric: BlockMetric;
  performance: PerformanceSummary | null | undefined;
}) {
  const name = metric.display_name ?? metric.catalog?.name ?? "Métrica";
  const value = resolveMetricValue(metric, performance ?? null);
  const format = metric.catalog?.format ?? null;
  const hasData = value !== null;

  return (
    <div className="bg-white/[0.02] rounded-xl border border-white/5 p-4 flex flex-col gap-2">
      <p className="text-[9px] text-white/25 tracking-[0.15em] uppercase font-light truncate">
        {name}
      </p>
      <p
        className={cn(
          "text-2xl font-light tabular-nums leading-none mt-1",
          hasData ? "text-white/85" : "text-white/20"
        )}
      >
        {hasData ? formatValue(value!, format) : "—"}
      </p>
      <span
        className={cn(
          "text-[9px] font-light",
          hasData ? "text-emerald-400/50" : "text-amber-400/40"
        )}
      >
        {hasData ? "Atualizado" : "Aguardando dados"}
      </span>
    </div>
  );
}

function KpiCardSm({
  metric,
  performance,
}: {
  metric: BlockMetric;
  performance: PerformanceSummary | null | undefined;
}) {
  const name = metric.display_name ?? metric.catalog?.name ?? "Métrica";
  const value = resolveMetricValue(metric, performance ?? null);
  const format = metric.catalog?.format ?? null;
  const hasData = value !== null;

  return (
    <div className="bg-white/[0.02] rounded-lg border border-white/5 p-3 flex flex-col gap-1.5">
      <p className="text-[9px] text-white/20 tracking-[0.15em] uppercase font-light truncate">
        {name}
      </p>
      <p
        className={cn(
          "text-xl font-light tabular-nums leading-none",
          hasData ? "text-white/80" : "text-white/[0.14]"
        )}
      >
        {hasData ? formatValue(value!, format) : "—"}
      </p>
      <span
        className={cn(
          "text-[8px] font-light",
          hasData ? "text-emerald-400/40" : "text-amber-400/30"
        )}
      >
        {hasData ? "Atualizado" : "Aguardando dados"}
      </span>
    </div>
  );
}

// ── Placeholder de métricas vazias ────────────────────────────────────────────

function EmptyMetrics() {
  return (
    <div className="h-20 flex items-center justify-center rounded-xl border border-dashed border-white/[0.04]">
      <p className="text-[10px] text-white/[0.10] font-light">Sem métricas configuradas</p>
    </div>
  );
}

// ── MetaAdsView ───────────────────────────────────────────────────────────────

interface MetaAdsViewProps {
  blocks: BlockWithMetrics[];
  performance?: PerformanceData | null;
  initialPeriod?: string;
  initialStartDate?: string;
  initialEndDate?: string;
}

export function MetaAdsView({
  blocks,
  performance,
  initialPeriod = "last_7_days",
  initialStartDate = "",
  initialEndDate = "",
}: MetaAdsViewProps) {
  const router = useRouter();

  const [period, setPeriod] = useState(initialPeriod);
  const [customStart, setCustomStart] = useState(initialStartDate);
  const [customEnd, setCustomEnd] = useState(initialEndDate);

  // Mudança de período: usa router.replace para acionar refetch no servidor
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
          <PeriodFilter
            period={period}
            customStart={customStart}
            customEnd={customEnd}
            onChange={handlePeriodChange}
          />
        </div>
      </div>

      {/* ── Alcance e entrega ───────────────────────────────────── */}
      {overviewBlock && (
        <section>
          <p className="text-[9px] text-white/[0.15] tracking-[0.2em] uppercase font-light mb-3">
            Alcance e entrega
          </p>
          {overviewBlock.metrics.length > 0 ? (
            <div className={cn("grid gap-3", kpiGridCols(overviewBlock.metrics.length))}>
              {overviewBlock.metrics.map((m) => (
                <KpiCard key={m.id} metric={m} performance={summary} />
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
                performanceBlock.metrics.map((m) => (
                  <KpiCardSm key={m.id} metric={m} performance={summary} />
                ))
              ) : (
                <div className="h-32 flex items-center justify-center rounded-xl border border-dashed border-white/[0.04]">
                  <p className="text-[10px] text-white/[0.10] font-light">Sem métricas</p>
                </div>
              )}
            </div>
            <div className="md:col-span-2">
              <MetaAdsChart rows={rows} />
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
                <KpiCard key={m.id} metric={m} performance={summary} />
              ))}
            </div>
          ) : (
            <EmptyMetrics />
          )}
        </section>
      )}

      {/* ── Divisor ─────────────────────────────────────────────── */}
      <div className="border-t border-white/[0.04]" />

      {/* ── Análise detalhada ───────────────────────────────────── */}
      {otherBlocks.length > 0 && (
        <section>
          <p className="text-[9px] text-white/[0.12] tracking-[0.2em] uppercase font-light mb-3">
            Análise detalhada
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {otherBlocks.map(({ block, metrics }) => (
              <div key={block.id} className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-4">
                <p className="text-[9px] text-white/[0.15] tracking-[0.15em] uppercase font-light mb-3">
                  {block.title ?? "Bloco"}
                </p>
                {metrics.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {metrics.map((m) => (
                      <KpiCardSm key={m.id} metric={m} performance={summary} />
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

      {/* ── Dados por dia ───────────────────────────────────────── */}
      <section>
        <p className="text-[9px] text-white/[0.12] tracking-[0.2em] uppercase font-light mb-3">
          Dados por dia
        </p>
        <MetaAdsTable rows={rows} />
      </section>
    </div>
  );
}

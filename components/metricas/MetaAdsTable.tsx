"use client";

import { cn } from "@/lib/utils";
import type { PerformanceRow } from "@/types";

const COLS = [
  "Data",
  "Investimento",
  "Impressões",
  "Cliques",
  "CTR",
  "CPC",
  "Leads",
  "Mensagens",
  "Compras",
];

function fmtDate(iso: string): string {
  const parts = iso.split("-");
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function fmtCurrency(v: number | null): string {
  if (v === null) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
}

function fmtInt(v: number | null): string {
  if (v === null) return "—";
  return new Intl.NumberFormat("pt-BR").format(Math.round(v));
}

function fmtPct(v: number | null): string {
  if (v === null) return "—";
  return `${v.toFixed(2)}%`;
}

const SKELETON_WIDTHS = [
  [65, 40, 55, 35, 45, 30, 50, 40, 35],
  [80, 55, 45, 50, 35, 40, 45, 55, 30],
  [50, 45, 60, 40, 50, 35, 60, 35, 40],
  [70, 35, 50, 45, 40, 55, 35, 45, 50],
];

interface MetaAdsTableProps {
  rows: PerformanceRow[];
}

export function MetaAdsTable({ rows }: MetaAdsTableProps) {
  const isEmpty = rows.length === 0;
  const sorted = isEmpty ? [] : [...rows].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="rounded-2xl border border-white bg-white/60 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] overflow-x-auto">
      <div className="grid grid-cols-9 border-b border-slate-200/60 px-4 py-2.5 bg-slate-50/60 min-w-[720px]">
        {COLS.map((col) => (
          <p
            key={col}
            className="text-[9px] text-vitti-blue/50 tracking-[0.12em] uppercase font-light"
          >
            {col}
          </p>
        ))}
      </div>

      {isEmpty
        ? SKELETON_WIDTHS.map((widths, i) => (
            <div
              key={i}
              className={cn(
                "grid grid-cols-9 px-4 py-3 gap-x-2 min-w-[720px]",
                i < SKELETON_WIDTHS.length - 1 && "border-b border-slate-200/40"
              )}
            >
              {widths.map((w, j) => (
                <div
                  key={j}
                  className="h-1.5 rounded-full bg-vitti-blue/[0.07]"
                  style={{ width: `${w}%` }}
                />
              ))}
            </div>
          ))
        : sorted.map((row, i) => (
            <div
              key={row.date}
              className={cn(
                "grid grid-cols-9 px-4 py-3 gap-x-2 min-w-[720px] text-[11px] font-light tabular-nums items-center",
                i < sorted.length - 1 && "border-b border-slate-200/40"
              )}
            >
              <span className="text-vitti-blue/60">{fmtDate(row.date)}</span>
              <span className="text-vitti-blue">{fmtCurrency(row.spend)}</span>
              <span className="text-vitti-blue/70">{fmtInt(row.impressions)}</span>
              <span className="text-vitti-blue/70">{fmtInt(row.clicks)}</span>
              <span className="text-vitti-blue/70">{fmtPct(row.ctr)}</span>
              <span className="text-vitti-blue/70">{fmtCurrency(row.cpc)}</span>
              <span className="text-vitti-blue/70">{fmtInt(row.leads)}</span>
              <span className="text-vitti-blue/70">{fmtInt(row.messages_started)}</span>
              <span className="text-vitti-blue/70">{fmtInt(row.purchases)}</span>
            </div>
          ))}
    </div>
  );
}

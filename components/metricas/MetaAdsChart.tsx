"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3 } from "lucide-react";
import type { PerformanceRow } from "@/types";

function fmtAxisDate(iso: string): string {
  const parts = iso.split("-");
  return `${parts[2]}/${parts[1]}`;
}

function fmtSpend(v: number): string {
  if (v >= 1000) return `R$${(v / 1000).toFixed(0)}k`;
  return `R$${Math.round(v)}`;
}

function CustomTooltip({
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
  const dateLabel = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : label;

  return (
    <div className="rounded-xl border border-vitti-gray/[0.14] bg-white shadow-xl shadow-black/[0.08] px-4 py-3 space-y-2 min-w-[160px]">
      <p className="text-[9px] text-vitti-blue/45 tracking-[0.15em] uppercase font-light">
        {dateLabel}
      </p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-4">
          <span className="text-[10px] text-vitti-blue/60 font-light">
            {entry.name === "spend"
              ? "Investimento"
              : entry.name === "clicks"
              ? "Cliques"
              : "Leads"}
          </span>
          <span
            className="text-[11px] font-light tabular-nums"
            style={{ color: entry.color }}
          >
            {entry.name === "spend"
              ? new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                  minimumFractionDigits: 2,
                }).format(entry.value)
              : new Intl.NumberFormat("pt-BR").format(Math.round(entry.value))}
          </span>
        </div>
      ))}
    </div>
  );
}

interface MetaAdsChartProps {
  rows: PerformanceRow[];
}

export function MetaAdsChart({ rows }: MetaAdsChartProps) {
  if (rows.length === 0) {
    return (
      <div className="h-full min-h-[200px] rounded-xl border bg-vitti-gray/[0.08] border-vitti-gray/[0.14] backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.04)] flex flex-col items-center justify-center gap-2">
        <BarChart3 size={16} className="text-vitti-blue/20" />
        <p className="text-[10px] text-vitti-blue/30 font-light">Aguardando sincronização</p>
      </div>
    );
  }

  const showDots = rows.length <= 2;

  return (
    <div className="h-full min-h-[200px] rounded-xl border bg-vitti-gray/[0.08] border-vitti-gray/[0.14] backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.04)] overflow-hidden px-2 pt-3 pb-1">
      <ResponsiveContainer width="100%" height={196}>
        <ComposedChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="rgba(0,0,0,0.06)" />
          <XAxis
            dataKey="date"
            tickFormatter={fmtAxisDate}
            tick={{ fill: "rgba(0,0,0,0.35)", fontSize: 9, fontWeight: 300 }}
            axisLine={false}
            tickLine={false}
            dy={4}
          />
          <YAxis
            yAxisId="left"
            tickFormatter={fmtSpend}
            tick={{ fill: "rgba(0,0,0,0.25)", fontSize: 8, fontWeight: 300 }}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fill: "rgba(0,0,0,0.25)", fontSize: 8, fontWeight: 300 }}
            axisLine={false}
            tickLine={false}
            width={28}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: "rgba(0,0,0,0.03)" }}
          />
          <Bar
            yAxisId="left"
            dataKey="spend"
            fill="#455CAB"
            fillOpacity={0.55}
            radius={[2, 2, 0, 0]}
            maxBarSize={40}
          />
          <Line
            yAxisId="right"
            dataKey="clicks"
            stroke="rgba(0,0,0,0.35)"
            strokeWidth={1.5}
            dot={showDots ? { r: 3, fill: "rgba(0,0,0,0.35)", strokeWidth: 0 } : false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
          <Line
            yAxisId="right"
            dataKey="leads"
            stroke="#34d399"
            strokeWidth={1.5}
            dot={showDots ? { r: 3, fill: "#34d399", strokeWidth: 0 } : false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

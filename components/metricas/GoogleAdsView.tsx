"use client";

import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PerformanceData, PerformanceRow } from "@/types";
import type { GoogleAdsCampaignRow } from "@/lib/data/performance";

// ── Formatadores ───────────────────────────────────────────────────────────────

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

// ── Tendência ─────────────────────────────────────────────────────────────────

function computeTrend(
  rows: PerformanceRow[],
  key: keyof PerformanceRow
): { pct: number; up: boolean } | null {
  if (rows.length < 4) return null;
  const mid = Math.floor(rows.length / 2);
  const avg = (arr: PerformanceRow[]) =>
    arr.reduce((s, r) => s + (Number(r[key]) || 0), 0) / arr.length;
  const a = avg(rows.slice(0, mid));
  const b = avg(rows.slice(mid));
  if (a === 0) return null;
  return { pct: ((b - a) / a) * 100, up: b >= a };
}

// ── Sparkline ─────────────────────────────────────────────────────────────────

function Sparkline({
  rows,
  dataKey,
  color,
}: {
  rows: PerformanceRow[];
  dataKey: string;
  color: string;
}) {
  if (rows.length < 2) return null;
  const gradId = `gads-spark-${dataKey}`;
  return (
    <div className="h-9 w-full mt-1">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.35} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#${gradId})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string | null;
  pending?: boolean;
  rows?: PerformanceRow[];
  sparkKey?: keyof PerformanceRow;
  sparkColor?: string;
  trendKey?: keyof PerformanceRow;
}

function KpiCard({
  label,
  value,
  pending,
  rows = [],
  sparkKey,
  sparkColor = "#455CAB",
  trendKey,
}: KpiCardProps) {
  const trend = trendKey ? computeTrend(rows, trendKey) : null;

  return (
    <div className="flex flex-col gap-1.5 px-4 py-4 rounded-xl border border-white/[0.06] bg-white/[0.01]">
      <p className="text-[10px] font-light text-white/30 uppercase tracking-widest">
        {label}
      </p>
      {pending ? (
        <p className="text-xs font-light text-white/20 italic mt-1">Aguardando dados</p>
      ) : value !== null ? (
        <>
          <p className="text-xl font-light text-white/85 leading-none mt-0.5">{value}</p>
          {sparkKey && rows.length >= 2 && (
            <Sparkline rows={rows} dataKey={String(sparkKey)} color={sparkColor} />
          )}
          {trend && (
            <div
              className={cn(
                "flex items-center gap-1 text-[9px] font-light mt-0.5",
                trend.up ? "text-emerald-400/70" : "text-rose-400/60"
              )}
            >
              {trend.up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
              {trend.up ? "+" : ""}
              {trend.pct.toFixed(1)}%
            </div>
          )}
        </>
      ) : (
        <p className="text-xs font-light text-white/20 italic mt-1">—</p>
      )}
    </div>
  );
}

// ── Tooltip do gráfico ────────────────────────────────────────────────────────

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

  const labelMap: Record<string, string> = {
    spend: "Investimento",
    clicks: "Cliques",
    leads: "Conversões",
  };

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#111827] shadow-2xl shadow-black/80 px-4 py-3 space-y-2 min-w-[170px]">
      <p className="text-[9px] text-white/30 tracking-[0.15em] uppercase font-light">
        {dateLabel}
      </p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-4">
          <span className="text-[10px] text-white/40 font-light">
            {labelMap[entry.name] ?? entry.name}
          </span>
          <span
            className="text-[11px] font-light tabular-nums"
            style={{ color: entry.color }}
          >
            {entry.name === "spend"
              ? fmtCurrency(entry.value)
              : fmtNum(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Gráfico de evolução ────────────────────────────────────────────────────────

function EvolutionChart({
  rows,
  hasConversions,
}: {
  rows: PerformanceRow[];
  hasConversions: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] flex items-center justify-center h-52">
        <p className="text-[10px] text-white/[0.10] font-light">
          Aguardando sincronização
        </p>
      </div>
    );
  }

  const showDots = rows.length <= 2;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] overflow-hidden px-2 pt-5 pb-2">
      <div className="flex items-center justify-between px-2 mb-4">
        <p className="text-[9px] text-white/[0.20] tracking-[0.15em] uppercase font-light">
          Evolução diária
        </p>
        <div className="flex items-center gap-4 text-[9px] font-light text-white/25">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-1.5 rounded-sm bg-vitti-blue/60 inline-block" />
            Investimento
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-px bg-[#638ACC] inline-block" />
            Cliques
          </span>
          {hasConversions && (
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-px bg-emerald-400 inline-block" />
              Conversões
            </span>
          )}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.03)" />
          <XAxis
            dataKey="date"
            tickFormatter={fmtAxisDate}
            tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 9, fontWeight: 300 }}
            axisLine={false}
            tickLine={false}
            dy={4}
          />
          <YAxis
            yAxisId="left"
            tickFormatter={fmtAxisSpend}
            tick={{ fill: "rgba(255,255,255,0.15)", fontSize: 8, fontWeight: 300 }}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fill: "rgba(255,255,255,0.15)", fontSize: 8, fontWeight: 300 }}
            axisLine={false}
            tickLine={false}
            width={28}
          />
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ fill: "rgba(255,255,255,0.02)" }}
          />
          <Bar
            yAxisId="left"
            dataKey="spend"
            fill="#455CAB"
            fillOpacity={0.6}
            radius={[3, 3, 0, 0]}
            maxBarSize={40}
          />
          <Line
            yAxisId="right"
            dataKey="clicks"
            stroke="#638ACC"
            strokeWidth={1.5}
            dot={showDots ? { r: 3, fill: "#638ACC", strokeWidth: 0 } : false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
          {hasConversions && (
            <Line
              yAxisId="right"
              dataKey="leads"
              stroke="#34d399"
              strokeWidth={1.5}
              dot={showDots ? { r: 3, fill: "#34d399", strokeWidth: 0 } : false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Tabela de campanhas ───────────────────────────────────────────────────────

function CampaignTable({ campaigns }: { campaigns: GoogleAdsCampaignRow[] }) {
  if (campaigns.length === 0) return null;

  const HEADERS = [
    "Campanha",
    "Invest.",
    "Impressões",
    "Cliques",
    "CTR",
    "CPC",
    "Conv.",
    "Custo/Conv.",
  ];

  return (
    <div className="border border-white/[0.06] rounded-xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-white/[0.04] bg-white/[0.01]">
        <p className="text-[9px] text-white/[0.20] tracking-[0.15em] uppercase font-light">
          Campanhas
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-light">
          <thead>
            <tr className="border-b border-white/[0.04]">
              {HEADERS.map((h) => (
                <th
                  key={h}
                  className="text-left px-4 py-2.5 text-[10px] text-white/25 font-light whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c, i) => (
              <tr
                key={c.campaignId}
                className={cn(
                  "hover:bg-white/[0.02] transition-colors",
                  i < campaigns.length - 1 && "border-b border-white/[0.03]"
                )}
              >
                <td className="px-4 py-3 text-white/60 max-w-[200px] truncate">
                  {c.campaignName ?? c.campaignId}
                </td>
                <td className="px-4 py-3 text-white/70 tabular-nums whitespace-nowrap">
                  {fmtCurrency(c.spend)}
                </td>
                <td className="px-4 py-3 text-white/50 tabular-nums whitespace-nowrap">
                  {fmtNum(c.impressions)}
                </td>
                <td className="px-4 py-3 text-white/50 tabular-nums whitespace-nowrap">
                  {fmtNum(c.clicks)}
                </td>
                <td className="px-4 py-3 text-white/50 tabular-nums whitespace-nowrap">
                  {c.ctr !== null ? fmtPct(c.ctr) : "—"}
                </td>
                <td className="px-4 py-3 text-white/50 tabular-nums whitespace-nowrap">
                  {c.cpc !== null ? fmtCurrency(c.cpc) : "—"}
                </td>
                <td className="px-4 py-3 text-white/50 tabular-nums whitespace-nowrap">
                  {c.leads > 0 ? fmtNum(c.leads) : "—"}
                </td>
                <td className="px-4 py-3 text-white/50 tabular-nums whitespace-nowrap">
                  {c.costPerLead !== null ? fmtCurrency(c.costPerLead) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── GoogleAdsView ─────────────────────────────────────────────────────────────

interface Props {
  performance?: PerformanceData | null;
  campaigns?: GoogleAdsCampaignRow[];
}

export function GoogleAdsView({ performance, campaigns = [] }: Props) {
  if (!performance) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 rounded-xl border border-dashed border-white/5">
        <div className="w-10 h-10 rounded-full bg-white/[0.03] border border-white/8 flex items-center justify-center">
          <span className="text-white/15 text-sm font-light">G</span>
        </div>
        <div className="text-center space-y-1.5">
          <p className="text-sm font-light text-white/40">
            Nenhum dado Google Ads disponível
          </p>
          <p className="text-xs text-white/20 font-light max-w-xs leading-relaxed">
            Mapeie uma conta Google Ads em Admin → Integrações e sincronize os dados.
          </p>
        </div>
      </div>
    );
  }

  const s = performance.summary;
  const rows = performance.rows;

  const spend = typeof s.spend === "number" ? s.spend : null;
  const impressions = typeof s.impressions === "number" ? s.impressions : null;
  const clicks = typeof s.clicks === "number" ? s.clicks : null;
  const cpc = typeof s.cpc === "number" ? s.cpc : null;
  const ctr = typeof s.ctr === "number" ? s.ctr : null;
  const conversions = typeof s.leads === "number" ? s.leads : null;
  const hasConversions = conversions !== null && conversions > 0;
  const costPerConversion =
    hasConversions && spend !== null ? spend / conversions! : null;

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3">
        <KpiCard
          label="Investimento"
          value={spend !== null ? fmtCurrency(spend) : null}
          rows={rows}
          sparkKey="spend"
          sparkColor="#455CAB"
          trendKey="spend"
        />
        <KpiCard
          label="Conversões"
          value={hasConversions ? fmtNum(conversions!) : null}
          pending={!hasConversions}
          rows={rows}
          sparkKey={hasConversions ? "leads" : undefined}
          sparkColor="#34d399"
          trendKey="leads"
        />
        <KpiCard
          label="Custo / Conv."
          value={costPerConversion !== null ? fmtCurrency(costPerConversion) : null}
          pending={!hasConversions}
        />
        <KpiCard
          label="Cliques"
          value={clicks !== null ? fmtNum(clicks) : null}
          rows={rows}
          sparkKey="clicks"
          sparkColor="#638ACC"
          trendKey="clicks"
        />
        <KpiCard
          label="Impressões"
          value={impressions !== null ? fmtNum(impressions) : null}
        />
        <KpiCard
          label="CPC"
          value={cpc !== null ? fmtCurrency(cpc) : null}
        />
        <KpiCard
          label="CTR"
          value={ctr !== null ? fmtPct(ctr) : null}
        />
      </div>

      {/* Gráfico de evolução */}
      <EvolutionChart rows={rows} hasConversions={hasConversions} />

      {/* Tabela de campanhas */}
      <CampaignTable campaigns={campaigns} />
    </div>
  );
}

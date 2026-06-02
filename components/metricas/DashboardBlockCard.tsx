import { BarChart3, LineChart, PieChart, Table2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import type { DashboardBlock, BlockMetric } from "@/types";

interface Props {
  block: DashboardBlock;
  metrics: BlockMetric[];
}

const BLOCK_TYPE_LABELS: Record<string, string> = {
  kpi_card: "Cartão de KPI",
  metric_card: "Cartão de Métricas",
  line_chart: "Gráfico de Linha",
  bar_chart: "Gráfico de Barras",
  area_chart: "Gráfico de Área",
  pie_chart: "Gráfico de Pizza",
  table: "Tabela",
};

function blockTypeLabel(type: string): string {
  return BLOCK_TYPE_LABELS[type] ?? type.replace(/_/g, " ");
}

function isChartBlock(type: string): boolean {
  return (
    type.includes("chart") ||
    type === "line" ||
    type === "bar" ||
    type === "area"
  );
}

function ChartIcon({ type }: { type: string }) {
  if (type.includes("line") || type.includes("area")) {
    return <LineChart size={20} className="text-vitti-blue/20" />;
  }
  if (type.includes("pie")) {
    return <PieChart size={20} className="text-vitti-blue/20" />;
  }
  if (type === "table") {
    return <Table2 size={20} className="text-vitti-blue/20" />;
  }
  return <BarChart3 size={20} className="text-vitti-blue/20" />;
}

function unitPlaceholder(unit: string | null): string {
  if (unit === "percentage") return "—%";
  if (unit === "currency") return "R$ —";
  return "—";
}

export function DashboardBlockCard({ block, metrics }: Props) {
  const hasMetrics = metrics.length > 0;
  const isChart = isChartBlock(block.block_type);

  const badgeLabel = hasMetrics ? "Aguardando dados" : "Em breve";
  const badgeVariant = hasMetrics
    ? ("warning" as const)
    : ("default" as const);

  return (
    <div className="rounded-2xl border border-white bg-white/60 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-xs font-light text-vitti-blue/70 tracking-widest uppercase truncate">
            {block.title ?? "Bloco"}
          </h3>
          <p className="text-[11px] text-vitti-blue/45 mt-0.5 font-light">
            {blockTypeLabel(block.block_type)}
          </p>
        </div>
        <Badge label={badgeLabel} variant={badgeVariant} />
      </div>

      {/* Metric chips (for kpi/metric card blocks) */}
      {hasMetrics && !isChart && (
        <div
          className={cn(
            "grid gap-2",
            metrics.length === 1 ? "grid-cols-1" : "grid-cols-2"
          )}
        >
          {metrics.map((m) => (
            <div
              key={m.id}
              className="bg-slate-100/60 rounded-lg p-3 border border-slate-200"
            >
              <p className="text-[10px] text-vitti-blue/50 font-light tracking-widest uppercase truncate">
                {m.display_name ?? m.catalog?.name ?? "Métrica"}
              </p>
              <p className="mt-2 text-lg font-light text-vitti-blue/30 tabular-nums">
                {unitPlaceholder(m.catalog?.unit ?? null)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Chart placeholder */}
      {isChart && (
        <div className="h-32 flex flex-col items-center justify-center gap-2 border border-dashed border-vitti-gray/[0.20] rounded-lg">
          <ChartIcon type={block.block_type} />
          <p className="text-[11px] text-vitti-blue/30 font-light">
            {hasMetrics ? "Aguardando sincronização" : "Sem métricas configuradas"}
          </p>
        </div>
      )}

      {/* Table placeholder */}
      {block.block_type === "table" && (
        <div className="h-24 flex flex-col items-center justify-center gap-2 border border-dashed border-vitti-gray/[0.20] rounded-lg">
          <Table2 size={18} className="text-vitti-blue/20" />
          <p className="text-[11px] text-vitti-blue/30 font-light">
            {hasMetrics ? "Aguardando sincronização" : "Sem métricas configuradas"}
          </p>
        </div>
      )}

      {/* Generic empty state (no metrics, no chart) */}
      {!hasMetrics && !isChart && block.block_type !== "table" && (
        <div className="h-24 flex flex-col items-center justify-center gap-2 border border-dashed border-vitti-gray/[0.20] rounded-lg">
          <BarChart3 size={18} className="text-vitti-blue/20" />
          <p className="text-[11px] text-vitti-blue/30 font-light">
            Aguardando configuração
          </p>
        </div>
      )}
    </div>
  );
}

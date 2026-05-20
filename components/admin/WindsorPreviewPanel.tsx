"use client";

import { useState } from "react";
import { Plug, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import type { WindsorPreviewApiResponse } from "@/lib/integrations/windsor/types";

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtInt(v: number): string {
  return new Intl.NumberFormat("pt-BR").format(Math.round(v));
}

function fmtCurrency(v: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
}

function fmtDateBR(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function defaultDates(): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString().slice(0, 10);
  const s = new Date(now);
  s.setUTCDate(s.getUTCDate() - 6);
  return { start: s.toISOString().slice(0, 10), end };
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface WindsorPreviewPanelProps {
  windsorConfigured: boolean;
  maskedKey?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function WindsorPreviewPanel({ windsorConfigured, maskedKey }: WindsorPreviewPanelProps) {
  const { start: defaultStart, end: defaultEnd } = defaultDates();

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WindsorPreviewApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handlePreview() {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const params = new URLSearchParams({ startDate, endDate });
      const res = await fetch(`/api/admin/windsor/preview?${params.toString()}`);
      const json: WindsorPreviewApiResponse = await res.json();

      if (!json.success) {
        setError(json.error ?? "Erro desconhecido no preview.");
        return;
      }

      setResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha na requisição ao servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] divide-y divide-white/[0.04]">

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-4 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center shrink-0">
            <Plug size={14} className="text-vitti-light/30" />
          </div>
          <div>
            <p className="text-xs font-light text-white/65">Windsor AI</p>
            <p className="text-[10px] font-light text-white/25 mt-0.5">
              Fonte de dados de performance — conector Facebook/Meta Ads
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={cn(
              "text-[9px] font-light px-2.5 py-1 rounded-full border",
              windsorConfigured
                ? "text-emerald-400/60 border-emerald-400/20 bg-emerald-400/[0.05]"
                : "text-amber-400/50 border-amber-400/15 bg-amber-400/[0.04]"
            )}
          >
            {windsorConfigured
              ? maskedKey
                ? `Chave: ${maskedKey}`
                : "Chave configurada"
              : "Chave ausente"}
          </span>
          <Badge label="Preview ativo" variant="info" />
        </div>
      </div>

      {/* ── Controles de preview ──────────────────────────────── */}
      <div className="px-5 py-4 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-[9px] text-white/25 uppercase tracking-[0.15em] font-light shrink-0">
              De
            </label>
            <input
              type="date"
              value={startDate}
              max={endDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-[11px] text-white/50 font-light focus:outline-none focus:border-vitti-blue/40 transition-colors [color-scheme:dark]"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[9px] text-white/25 uppercase tracking-[0.15em] font-light shrink-0">
              Até
            </label>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-[11px] text-white/50 font-light focus:outline-none focus:border-vitti-blue/40 transition-colors [color-scheme:dark]"
            />
          </div>
          <button
            onClick={handlePreview}
            disabled={loading || !windsorConfigured}
            className={cn(
              "flex items-center gap-1.5 px-4 py-1.5 rounded-full border text-[11px] font-light transition-all duration-150 select-none",
              loading || !windsorConfigured
                ? "border-white/[0.07] text-white/20 cursor-not-allowed"
                : "border-vitti-blue/30 text-vitti-light/80 bg-vitti-blue/[0.10] hover:bg-vitti-blue/[0.16] cursor-pointer"
            )}
          >
            <RefreshCw
              size={10}
              className={cn("shrink-0", loading && "animate-spin")}
            />
            {loading ? "Buscando..." : "Pré-visualizar Windsor"}
          </button>
        </div>

        {/* Disclaimer */}
        <p className="text-[9px] text-white/[0.18] font-light">
          Preview apenas — nenhum dado será salvo em performance_daily.
        </p>

        {/* ── Estado de erro ────────────────────────────────────── */}
        {error && (
          <div className="flex items-start gap-2.5 rounded-xl border border-red-500/15 bg-red-500/[0.04] px-4 py-3">
            <AlertCircle size={13} className="text-red-400/50 shrink-0 mt-0.5" />
            <p className="text-[11px] font-light text-red-400/60 leading-relaxed">
              {error}
            </p>
          </div>
        )}

        {/* ── Estado de sucesso ─────────────────────────────────── */}
        {result && result.success && (
          <div className="space-y-4">
            {/* Contagem */}
            <div className="flex items-center gap-2">
              <CheckCircle2 size={12} className="text-emerald-400/50 shrink-0" />
              <p className="text-[11px] font-light text-white/40">
                <span className="text-white/60">{fmtInt(result.totalRecords)}</span>
                {" "}registros encontrados ·{" "}
                {fmtDateBR(result.dateRange.start)} → {fmtDateBR(result.dateRange.end)}
              </p>
            </div>

            {/* Totais */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(
                [
                  { label: "Investimento", value: fmtCurrency(result.totals.spend) },
                  { label: "Impressões", value: fmtInt(result.totals.impressions) },
                  { label: "Cliques", value: fmtInt(result.totals.clicks) },
                  { label: "Alcance", value: fmtInt(result.totals.reach) },
                  { label: "Mensagens", value: fmtInt(result.totals.messages_started) },
                  { label: "Leads", value: fmtInt(result.totals.leads) },
                  { label: "Compras", value: fmtInt(result.totals.purchases) },
                ] as const
              ).map(({ label, value }) => (
                <div
                  key={label}
                  className="bg-white/[0.02] rounded-lg border border-white/[0.04] px-3 py-2.5"
                >
                  <p className="text-[8px] text-white/20 uppercase tracking-[0.15em] font-light">
                    {label}
                  </p>
                  <p className="text-sm font-light text-white/65 tabular-nums mt-1">{value}</p>
                </div>
              ))}
            </div>

            {/* Amostra de registros */}
            {result.sampleRecords.length > 0 && (
              <div>
                <p className="text-[9px] text-white/[0.15] uppercase tracking-[0.15em] font-light mb-2">
                  Amostra ({result.sampleRecords.length} de {fmtInt(result.totalRecords)})
                </p>
                <div className="rounded-xl border border-white/[0.05] overflow-hidden">
                  <div className="grid grid-cols-4 px-4 py-2 bg-white/[0.02] border-b border-white/[0.04]">
                    {(["Data", "Campanha", "Invest.", "Cliques"] as const).map((h) => (
                      <p
                        key={h}
                        className="text-[9px] text-white/20 uppercase tracking-[0.12em] font-light"
                      >
                        {h}
                      </p>
                    ))}
                  </div>
                  {result.sampleRecords.map((rec, i) => (
                    <div
                      key={i}
                      className={cn(
                        "grid grid-cols-4 px-4 py-2.5 text-[11px] font-light tabular-nums items-center",
                        i < result.sampleRecords.length - 1 && "border-b border-white/[0.03]"
                      )}
                    >
                      <span className="text-white/40">{fmtDateBR(rec.date)}</span>
                      <span className="text-white/40 truncate pr-2">
                        {rec.campaign_name ?? "—"}
                      </span>
                      <span className="text-white/55">{fmtCurrency(rec.spend)}</span>
                      <span className="text-white/55">{fmtInt(rec.clicks)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

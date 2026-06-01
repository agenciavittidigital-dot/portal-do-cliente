"use client";

import { useState } from "react";
import { MapPin, RefreshCw, AlertCircle, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WindsorRegionalSyncApiResponse } from "@/app/api/admin/windsor/regional-sync/route";

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

// ── Stat card ─────────────────────────────────────────────────────────────────

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div className="bg-black/[0.02] rounded-lg border border-black/[0.05] px-3 py-2.5">
      <p className="text-[8px] text-[#5F6368]/50 uppercase tracking-[0.15em] font-light">{label}</p>
      <p
        className={cn(
          "text-sm font-light tabular-nums mt-1",
          highlight ? "text-emerald-400/70" : "text-[#111111]/75"
        )}
      >
        {value}
      </p>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function WindsorRegionalSyncPanel() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WindsorRegionalSyncApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSync() {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/admin/windsor/regional-sync", { method: "POST" });
      const json: WindsorRegionalSyncApiResponse = await res.json();

      if (!json.success) {
        const msg = json.errorDetail
          ? `${json.error ?? "Erro na sincronização regional."} — ${json.errorDetail}`
          : (json.error ?? "Erro na sincronização regional.");
        setError(msg);
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
    <div className="rounded-xl border border-black/[0.07] bg-black/[0.02] divide-y divide-white/[0.04]">

      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-4 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-black/[0.03] border border-black/[0.07] flex items-center justify-center shrink-0">
            <MapPin size={14} className="text-vitti-light/30" />
          </div>
          <div>
            <p className="text-xs font-light text-[#111111]/75">
              Sincronização regional Windsor → performance_breakdowns
            </p>
            <p className="text-[10px] font-light text-[#5F6368]/55 mt-0.5">
              Grava breakdown por região — separado de performance_daily (sem impacto nos KPIs)
            </p>
          </div>
        </div>
        <button
          onClick={handleSync}
          disabled={loading}
          className={cn(
            "flex items-center gap-1.5 px-4 py-1.5 rounded-full border text-[11px] font-light transition-all duration-150 select-none",
            loading
              ? "border-black/[0.08] text-[#5F6368]/50 cursor-not-allowed"
              : "border-vitti-blue/30 text-vitti-light/80 bg-vitti-blue/[0.10] hover:bg-vitti-blue/[0.16] cursor-pointer"
          )}
        >
          <RefreshCw size={10} className={cn("shrink-0", loading && "animate-spin")} />
          {loading ? "Sincronizando..." : "Sincronizar breakdown regional"}
        </button>
      </div>

      {/* ── Aviso ─────────────────────────────────────────────────── */}
      <div className="px-5 py-3">
        <div className="flex items-start gap-2 rounded-lg border border-amber-400/[0.12] bg-amber-400/[0.03] px-3.5 py-2.5">
          <AlertTriangle size={11} className="text-amber-400/45 shrink-0 mt-0.5" />
          <p className="text-[10px] font-light text-amber-400/50 leading-relaxed">
            Requer campo{" "}
            <span className="font-mono text-[9px]">region</span> retornado pela Windsor. Linhas sem
            região são ignoradas. Sync idempotente — pode ser repetido sem duplicar dados.
          </p>
        </div>
      </div>

      {/* ── Conteúdo ──────────────────────────────────────────────── */}
      <div className="px-5 py-4 space-y-4">

        {/* Erro */}
        {error && (
          <div className="flex items-start gap-2.5 rounded-xl border border-red-500/15 bg-red-500/[0.04] px-4 py-3">
            <AlertCircle size={13} className="text-red-400/50 shrink-0 mt-0.5" />
            <p className="text-[11px] font-light text-red-400/60 leading-relaxed break-words">
              {error}
            </p>
          </div>
        )}

        {/* Sucesso */}
        {result && result.success && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={12} className="text-emerald-400/50 shrink-0" />
              <p className="text-[11px] font-light text-[#5F6368]/70">
                Sincronização regional concluída ·{" "}
                <span className="font-mono text-[9px] text-[#5F6368]/55">{result.datePreset}</span>
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              <Stat label="Buscados" value={fmtInt(result.totalFetched)} />
              <Stat label="Mapeados" value={fmtInt(result.mappedRecords)} />
              <Stat label="Agrupados" value={fmtInt(result.groupedRecords)} />
              <Stat label="Sem região" value={fmtInt(result.skippedNoRegion)} />
              <Stat label="Ignorados" value={fmtInt(result.skippedUnmapped)} />
              <Stat label="Gravados" value={fmtInt(result.upserted)} highlight={result.upserted > 0} />
            </div>

            {/* Amostra gravada */}
            {result.sampleSaved.length > 0 && (
              <div>
                <p className="text-[9px] text-white/[0.15] uppercase tracking-[0.15em] font-light mb-2">
                  Amostra gravada
                </p>
                <div className="rounded-xl border border-black/[0.06] overflow-hidden">
                  <div className="grid grid-cols-3 px-4 py-2 bg-black/[0.02] border-b border-black/[0.05]">
                    {(["Região", "Conta", "Investimento"] as const).map((h) => (
                      <p key={h} className="text-[9px] text-[#5F6368]/50 uppercase tracking-[0.12em] font-light">
                        {h}
                      </p>
                    ))}
                  </div>
                  {result.sampleSaved.map((rec, i) => (
                    <div
                      key={i}
                      className={cn(
                        "grid grid-cols-3 px-4 py-2.5 text-[10px] font-light tabular-nums items-center",
                        i < result.sampleSaved.length - 1 && "border-b border-black/[0.04]"
                      )}
                    >
                      <span className="text-[#5F6368]/70 truncate pr-2">{rec.region}</span>
                      <span className="text-[#5F6368]/65 truncate pr-2">{rec.accountName}</span>
                      <span className="text-[#111111]/65">{fmtCurrency(rec.spend)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Contas não mapeadas */}
            {result.unmappedAccounts.length > 0 && (
              <div className="rounded-lg border border-black/[0.06] bg-black/[0.02] px-4 py-3 space-y-1.5">
                <p className="text-[9px] text-white/[0.15] uppercase tracking-[0.15em] font-light">
                  Contas ignoradas — sem mapeamento
                </p>
                <div className="space-y-1">
                  {result.unmappedAccounts.map((name) => (
                    <p key={name} className="text-[10px] font-light text-[#5F6368]/60">
                      · {name}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {result.totalFetched === 0 && (
              <p className="text-[11px] font-light text-white/[0.18]">
                Nenhum dado retornado pela Windsor. Verifique se o campo{" "}
                <span className="font-mono text-[9px]">region</span> está disponível no conector.
              </p>
            )}

            {result.totalFetched > 0 && result.upserted === 0 && result.skippedNoRegion === result.mappedRecords && (
              <p className="text-[11px] font-light text-white/[0.18]">
                Windsor retornou dados mas sem campo{" "}
                <span className="font-mono text-[9px]">region</span>. O conector Meta Ads pode não
                suportar este campo.
              </p>
            )}
          </div>
        )}

        {/* Estado inicial */}
        {!result && !error && !loading && (
          <p className="text-[11px] font-light text-white/[0.18] text-center py-2">
            Clique em &quot;Sincronizar breakdown regional&quot; para iniciar.
          </p>
        )}
      </div>
    </div>
  );
}

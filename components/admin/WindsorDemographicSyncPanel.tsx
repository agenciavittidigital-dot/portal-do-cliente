"use client";

import { useState } from "react";
import { Users, RefreshCw, AlertCircle, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WindsorDemographicSyncApiResponse } from "@/app/api/admin/windsor/demographic-sync/route";

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

function fmtInt(v: number): string {
  return new Intl.NumberFormat("pt-BR").format(Math.round(v));
}

// ── Component ─────────────────────────────────────────────────────────────────

export function WindsorDemographicSyncPanel() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WindsorDemographicSyncApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSync() {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/admin/windsor/demographic-sync", { method: "POST" });
      const json: WindsorDemographicSyncApiResponse = await res.json();

      if (!json.success) {
        const msg = json.errorDetail
          ? `${json.error ?? "Erro na sincronização demográfica."} — ${json.errorDetail}`
          : (json.error ?? "Erro na sincronização demográfica.");
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
            <Users size={14} className="text-vitti-light/30" />
          </div>
          <div>
            <p className="text-xs font-light text-[#111111]/75">
              Sincronização demográfica Windsor → performance_breakdowns
            </p>
            <p className="text-[10px] font-light text-[#5F6368]/55 mt-0.5">
              Grava breakdown por gênero e faixa etária — separado de performance_daily
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
          {loading ? "Sincronizando..." : "Sincronizar gênero e faixa etária"}
        </button>
      </div>

      {/* ── Aviso ─────────────────────────────────────────────────── */}
      <div className="px-5 py-3">
        <div className="flex items-start gap-2 rounded-lg border border-amber-400/[0.12] bg-amber-400/[0.03] px-3.5 py-2.5">
          <AlertTriangle size={11} className="text-amber-400/45 shrink-0 mt-0.5" />
          <p className="text-[10px] font-light text-amber-400/50 leading-relaxed">
            Requer campos{" "}
            <span className="font-mono text-[9px]">gender</span> e{" "}
            <span className="font-mono text-[9px]">age</span> retornados pela Windsor. Busca os
            últimos 30 dias. Sync idempotente — pode ser repetido sem duplicar dados.
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
                Sincronização demográfica concluída
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              <Stat label="Buscados Windsor" value={fmtInt(result.totalFetched)} />
              <Stat label="Registros gênero" value={fmtInt(result.genderRecords)} highlight={result.genderRecords > 0} />
              <Stat label="Registros idade" value={fmtInt(result.ageRecords)} highlight={result.ageRecords > 0} />
              <Stat label="Gravados (upsert)" value={fmtInt(result.upserted)} highlight={result.upserted > 0} />
              <Stat label="Ignorados" value={fmtInt(result.skippedUnmapped)} />
            </div>

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

            {/* Nenhum dado da Windsor */}
            {result.totalFetched === 0 && (
              <p className="text-[11px] font-light text-white/[0.18]">
                Nenhum dado retornado pela Windsor. Verifique se os campos{" "}
                <span className="font-mono text-[9px]">gender</span> e{" "}
                <span className="font-mono text-[9px]">age</span> estão disponíveis no conector Meta Ads.
              </p>
            )}

            {/* Dados buscados mas sem gender/age */}
            {result.totalFetched > 0 && result.genderRecords === 0 && result.ageRecords === 0 && (
              <p className="text-[11px] font-light text-white/[0.18]">
                Windsor retornou dados mas sem campos de gênero ou faixa etária. O conector Meta Ads pode
                não suportar esses breakdowns para esta conta.
              </p>
            )}
          </div>
        )}

        {/* Estado inicial */}
        {!result && !error && !loading && (
          <p className="text-[11px] font-light text-white/[0.18] text-center py-2">
            Clique em &quot;Sincronizar gênero e faixa etária&quot; para iniciar.
          </p>
        )}
      </div>
    </div>
  );
}

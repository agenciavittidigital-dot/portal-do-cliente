"use client";

import { useState } from "react";
import { Layers, RefreshCw, CheckCircle2, XCircle, AlertCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FullSyncApiResponse } from "@/app/api/admin/windsor/full-sync/route";

// ── Tipos internos ────────────────────────────────────────────────────────────

type SyncPhase = "idle" | "running" | "done";

interface ProcessDef {
  key: keyof Omit<FullSyncApiResponse, "success" | "partialSuccess" | "executedAt" | "dateRange" | "error">;
  label: string;
  description: string;
}

const PROCESSES: ProcessDef[] = [
  { key: "meta",        label: "Meta Ads principal",   description: "performance_daily — 30 dias" },
  { key: "googleAds",   label: "Google Ads principal",  description: "performance_daily — 30 dias" },
  { key: "demographic", label: "Demográficos",           description: "performance_breakdowns — 30 dias" },
  { key: "regional",    label: "Regional",               description: "performance_breakdowns — 30 dias" },
  { key: "keywords",    label: "Keywords Google Ads",    description: "google_ads_keywords — 30 dias" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtInt(v: number | undefined): string {
  if (v === undefined) return "—";
  return new Intl.NumberFormat("pt-BR").format(Math.round(v));
}

function fmtDateBR(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function ProcessRow({
  proc,
  result,
  running,
}: {
  proc: ProcessDef;
  result: FullSyncApiResponse | null;
  running: boolean;
}) {
  const data = result?.[proc.key] as
    | { success: boolean; upserted?: number; error?: string; errorDetail?: string; mappedRecords?: number; genderRecords?: number; ageRecords?: number; rowsUpserted?: number; datePreset?: string }
    | undefined;

  const isSuccess = data?.success === true;
  const isFailure = data?.success === false;

  let countLabel = "—";
  if (data) {
    if (proc.key === "demographic") {
      const g = data.genderRecords ?? 0;
      const a = data.ageRecords ?? 0;
      countLabel = g + a > 0 ? `${fmtInt(g + a)} registros (${fmtInt(g)} gênero · ${fmtInt(a)} faixa)` : "0";
    } else if (proc.key === "keywords") {
      countLabel = fmtInt(data.rowsUpserted ?? data.upserted ?? 0);
    } else {
      countLabel = fmtInt(data.upserted ?? 0);
    }
  }

  return (
    <div className="flex items-start gap-3 py-3 border-b border-black/[0.04] last:border-b-0">
      {/* Status icon */}
      <div className="mt-0.5 shrink-0">
        {running && !data && (
          <Clock size={12} className="text-[#5F6368]/30 animate-pulse" />
        )}
        {isSuccess && (
          <CheckCircle2 size={12} className="text-emerald-400/60" />
        )}
        {isFailure && (
          <XCircle size={12} className="text-red-400/50" />
        )}
        {!running && !data && (
          <div className="w-3 h-3 rounded-full border border-black/[0.08]" />
        )}
      </div>

      {/* Labels */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-[11px] font-light text-[#111111]/70">{proc.label}</span>
          <span className="text-[9px] font-light text-[#5F6368]/45">{proc.description}</span>
        </div>
        {isFailure && data?.error && (
          <p className="text-[10px] font-light text-red-400/60 mt-0.5 leading-relaxed break-words">
            {data.error}
          </p>
        )}
        {isFailure && data?.errorDetail && (
          <p className="text-[9px] font-mono text-red-400/50 mt-0.5 leading-relaxed break-all">
            {data.errorDetail}
          </p>
        )}
      </div>

      {/* Count */}
      {data && (
        <span
          className={cn(
            "text-[10px] font-light tabular-nums shrink-0",
            isSuccess ? "text-[#5F6368]/60" : "text-red-400/50"
          )}
        >
          {isSuccess ? `${countLabel} gravados` : "falhou"}
        </span>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export function WindsorFullSyncPanel() {
  const [phase, setPhase] = useState<SyncPhase>("idle");
  const [result, setResult] = useState<FullSyncApiResponse | null>(null);
  const [reqError, setReqError] = useState<string | null>(null);

  async function handleFullSync() {
    setPhase("running");
    setResult(null);
    setReqError(null);

    try {
      const res = await fetch("/api/admin/windsor/full-sync", { method: "POST" });
      const json: FullSyncApiResponse = await res.json();
      setResult(json);
    } catch (e) {
      setReqError(e instanceof Error ? e.message : "Falha na requisição ao servidor.");
    } finally {
      setPhase("done");
    }
  }

  const isRunning = phase === "running";

  // Status do banner
  const allOk = result?.success === true;
  const partial = result?.partialSuccess === true;
  const allFailed = result !== null && !allOk && !partial;

  return (
    <div className="rounded-xl border border-vitti-blue/[0.12] bg-vitti-blue/[0.025] divide-y divide-white/[0.04]">

      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-4 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-vitti-blue/[0.06] border border-vitti-blue/[0.12] flex items-center justify-center shrink-0">
            <Layers size={14} className="text-vitti-blue/40" />
          </div>
          <div>
            <p className="text-xs font-light text-vitti-blue/80">
              Sincronização Completa
              <span className="ml-2 text-[8px] font-light px-1.5 py-0.5 rounded-full border border-vitti-blue/20 text-vitti-blue/40 bg-vitti-blue/[0.05] align-middle">
                RECOMENDADO
              </span>
            </p>
            <p className="text-[10px] font-light text-vitti-blue/40 mt-0.5">
              Meta Ads · Google Ads · Demográficos · Regional · Keywords — janela de 30 dias
            </p>
          </div>
        </div>

        <button
          onClick={handleFullSync}
          disabled={isRunning}
          className={cn(
            "flex items-center gap-1.5 px-4 py-1.5 rounded-full border text-[11px] font-light transition-all duration-150 select-none",
            isRunning
              ? "border-black/[0.08] text-[#5F6368]/50 cursor-not-allowed"
              : "border-vitti-blue/40 text-vitti-blue/80 bg-vitti-blue/[0.10] hover:bg-vitti-blue/[0.18] cursor-pointer"
          )}
        >
          <RefreshCw size={10} className={cn("shrink-0", isRunning && "animate-spin")} />
          {isRunning ? "Sincronizando..." : "Sincronizar tudo"}
        </button>
      </div>

      {/* ── Corpo ─────────────────────────────────────────────────── */}
      <div className="px-5 py-4 space-y-4">

        {/* Erro de rede */}
        {reqError && (
          <div className="flex items-start gap-2.5 rounded-xl border border-red-500/15 bg-red-500/[0.04] px-4 py-3">
            <AlertCircle size={13} className="text-red-400/50 shrink-0 mt-0.5" />
            <p className="text-[11px] font-light text-red-400/60 leading-relaxed break-words">
              {reqError}
            </p>
          </div>
        )}

        {/* Banner de resultado */}
        {result && (
          <div
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3.5 py-2.5",
              allOk   && "border-emerald-400/[0.15] bg-emerald-400/[0.03]",
              partial && "border-amber-400/[0.15] bg-amber-400/[0.03]",
              allFailed && "border-red-400/[0.15] bg-red-400/[0.03]"
            )}
          >
            {allOk    && <CheckCircle2 size={12} className="text-emerald-400/60 shrink-0" />}
            {partial  && <AlertCircle  size={12} className="text-amber-400/55  shrink-0" />}
            {allFailed && <XCircle     size={12} className="text-red-400/50    shrink-0" />}
            <div>
              <p
                className={cn(
                  "text-[11px] font-light",
                  allOk   && "text-emerald-400/70",
                  partial && "text-amber-400/65",
                  allFailed && "text-red-400/60"
                )}
              >
                {allOk    && "Todos os processos concluídos com sucesso."}
                {partial  && "Sincronização parcial — um ou mais processos falharam."}
                {allFailed && "Todos os processos falharam. Verifique os logs."}
              </p>
              {result.dateRange && (
                <p className="text-[9px] font-light text-[#5F6368]/45 mt-0.5 font-mono">
                  {result.dateRange.replace("/", " → ")} · {fmtDateBR(result.executedAt.slice(0, 10))} {result.executedAt.slice(11, 16)}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Lista de processos */}
        {(isRunning || result) && (
          <div className="rounded-lg border border-black/[0.06] bg-black/[0.015] px-4">
            {PROCESSES.map((proc) => (
              <ProcessRow
                key={proc.key}
                proc={proc}
                result={result}
                running={isRunning}
              />
            ))}
          </div>
        )}

        {/* Estado inicial */}
        {phase === "idle" && !reqError && (
          <p className="text-[11px] font-light text-white/[0.18] text-center py-2">
            Clique em &quot;Sincronizar tudo&quot; para iniciar todos os processos simultaneamente.
          </p>
        )}
      </div>
    </div>
  );
}

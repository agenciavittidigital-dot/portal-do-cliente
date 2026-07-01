"use client";

import { useState, useMemo } from "react";
import type { ClientCallRow } from "@/lib/data/calls-client";
import { Badge } from "@/components/ui/Badge";
import {
  Phone,
  ExternalLink,
  Clock,
  Video,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

// ── Constants ──────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  performance:         "Performance",
  alignment:           "Alinhamento",
  planning:            "Planejamento",
  onboarding:          "Onboarding",
  report_presentation: "Apresentação de Relatório",
  other:               "Outro",
};

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const PAGE_SIZE = 10;

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  if (!iso) return "—";
  const parts = iso.split("T")[0].split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return iso;
}

function formatDuration(minutes: number | null): string | null {
  if (!minutes) return null;
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

// ── Component ──────────────────────────────────────────────────────────────────

const SELECT_CLASS =
  "bg-white/60 backdrop-blur-sm border border-white/70 rounded-lg px-3 py-1.5 text-xs font-light text-vitti-fg-muted focus:outline-none focus:border-vitti-blue/30 transition-colors cursor-pointer";

const BTN_CLASS =
  "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-light border border-vitti-gray/[0.20] rounded-lg text-vitti-blue/60 hover:text-vitti-blue hover:border-vitti-blue/30 transition-all disabled:opacity-30 disabled:cursor-default";

export function CallsHistorySection({ calls }: { calls: ClientCallRow[] }) {
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear]   = useState("");
  const [page, setPage] = useState(0);

  const availableYears = useMemo(() => {
    const years = new Set(calls.map((c) => c.callDate.slice(0, 4)));
    return [...years].filter(Boolean).sort((a, b) => b.localeCompare(a));
  }, [calls]);

  const filtered = useMemo(() => {
    return calls.filter((c) => {
      if (selectedYear  && c.callDate.slice(0, 4) !== selectedYear)  return false;
      if (selectedMonth && c.callDate.slice(5, 7) !== selectedMonth) return false;
      return true;
    });
  }, [calls, selectedMonth, selectedYear]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated  = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const isFiltered = selectedMonth !== "" || selectedYear !== "";

  function handleMonth(val: string) { setSelectedMonth(val); setPage(0); }
  function handleYear(val: string)  { setSelectedYear(val);  setPage(0); }

  return (
    <div className="space-y-3">
      {/* Header + filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <p className="text-sm font-semibold text-vitti-fg">
          Histórico de reuniões gravadas
        </p>
        {filtered.length > 0 && (
          <Badge label={`${filtered.length}`} variant="default" />
        )}

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <select
            value={selectedMonth}
            onChange={(e) => handleMonth(e.target.value)}
            className={SELECT_CLASS}
          >
            <option value="">Todos os meses</option>
            {MONTH_NAMES.map((name, i) => {
              const val = String(i + 1).padStart(2, "0");
              return <option key={val} value={val}>{name}</option>;
            })}
          </select>

          <select
            value={selectedYear}
            onChange={(e) => handleYear(e.target.value)}
            className={SELECT_CLASS}
          >
            <option value="">Todos os anos</option>
            {availableYears.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Lista ou estado vazio */}
      {filtered.length === 0 ? (
        <div className="border border-dashed border-vitti-gray/[0.20] rounded-xl flex flex-col items-center justify-center py-12 gap-3">
          <Video size={24} className="text-vitti-blue/20" />
          <p className="text-[11px] text-vitti-blue/40 font-light">
            {isFiltered
              ? "Nenhuma reunião gravada encontrada para este período."
              : "Nenhuma reunião gravada disponível ainda."}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {paginated.map((call) => {
              const duration = formatDuration(call.durationMinutes);
              return (
                <div
                  key={call.id}
                  className="rounded-2xl border border-white bg-white/60 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] p-5 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgb(0,0,0,0.10)] transition-all duration-200"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200/60 flex items-center justify-center shrink-0 mt-0.5">
                        <Phone size={13} className="text-vitti-light/60" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-light text-vitti-blue truncate">
                          {call.title}
                        </p>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className="text-[10px] text-vitti-blue/50 font-light">
                            {TYPE_LABELS[call.callType] ?? call.callType}
                          </span>
                          <span className="text-[10px] text-vitti-blue/30">·</span>
                          <span className="text-[10px] text-vitti-blue/50 font-light">
                            {formatDate(call.callDate)}
                          </span>
                          {duration && (
                            <>
                              <span className="text-[10px] text-vitti-blue/30">·</span>
                              <span className="inline-flex items-center gap-1 text-[10px] text-vitti-blue/50 font-light">
                                <Clock size={9} />
                                {duration}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {call.recordingUrl && (
                      <a
                        href={call.recordingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-light border border-vitti-gray/[0.20] rounded-lg text-vitti-blue/60 hover:text-vitti-blue hover:border-vitti-blue/30 transition-all shrink-0"
                      >
                        <ExternalLink size={11} />
                        Gravação
                      </a>
                    )}
                  </div>

                  {(call.description || call.summary) && (
                    <div className="mt-3 pl-11 space-y-2">
                      {call.description && (
                        <p className="text-[11px] text-vitti-blue/60 font-light leading-relaxed">
                          {call.description}
                        </p>
                      )}
                      {call.summary && (
                        <div className="border-l border-vitti-gray/[0.20] pl-3">
                          <p className="text-[9px] text-vitti-blue/40 font-light uppercase tracking-widest mb-1">
                            Resumo
                          </p>
                          <p className="text-[11px] text-vitti-blue/65 font-light leading-relaxed whitespace-pre-line">
                            {call.summary}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 0}
                className={BTN_CLASS}
              >
                <ChevronLeft size={13} />
                Anterior
              </button>

              <span className="text-[10px] text-vitti-fg-muted/60 font-light">
                {page + 1} de {totalPages}
              </span>

              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page + 1 >= totalPages}
                className={BTN_CLASS}
              >
                Próximas 10
                <ChevronRight size={13} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

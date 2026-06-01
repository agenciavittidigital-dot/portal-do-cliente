"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClientInvoiceRow } from "@/lib/data/invoices-client";

// ── Constantes ────────────────────────────────────────────────────────────────

const MONTHS_PT = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];
const PER_PAGE = 10;

// ── Formatadores ──────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

function fmtCurrency(v: number | null): string {
  if (v == null) return "";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtRefMonth(dateStr: string | null): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length >= 2) {
    const month = MONTHS_PT[parseInt(parts[1], 10) - 1] ?? parts[1];
    return `${month} ${parts[0]}`;
  }
  return dateStr;
}

function fmtFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  invoices: ClientInvoiceRow[];
  downloadUrls: Record<string, string | null>;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function NfHistorySection({ invoices, downloadUrls }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [filterVal, setFilterVal] = useState("");
  const [page, setPage] = useState(1);

  if (invoices.length < 2) return null;

  // Opções de filtro derivadas de referenceMonth ou createdAt
  const filterMap = new Map<string, string>();
  for (const inv of invoices) {
    const src = inv.referenceMonth ?? inv.createdAt;
    if (!src) continue;
    const d = new Date(src);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const key = `${year}-${String(month).padStart(2, "0")}`;
    if (!filterMap.has(key)) {
      filterMap.set(key, `${MONTHS_PT[month - 1]} ${year}`);
    }
  }
  const filterOptions = [...filterMap.entries()]; // [key, label]

  function handleFilterChange(val: string) {
    setFilterVal(val);
    setPage(1);
  }

  // Filtrar por mês/ano
  const filtered = filterVal
    ? invoices.filter((inv) => {
        const src = inv.referenceMonth ?? inv.createdAt;
        if (!src) return false;
        const d = new Date(src);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        return key === filterVal;
      })
    : invoices;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage   = Math.min(page, totalPages);
  const pageRows   = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  return (
    <div className="mt-4">
      {/* Botão de toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-[11px] font-light text-[#455cab]/70 hover:text-[#455cab] transition-colors"
      >
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {expanded ? "Ocultar histórico" : "Ver histórico de NFs"}
        <span className="text-[10px] text-[#171f38]/30 font-light ml-0.5">
          ({invoices.length} {invoices.length === 1 ? "nota" : "notas"})
        </span>
      </button>

      {/* Histórico expandido */}
      {expanded && (
        <div className="mt-3">
          <div className="rounded-xl border bg-[#f1f1f1] border-[#dfdedf] overflow-hidden">

            {/* Cabeçalho */}
            <div className="px-4 py-3.5 border-b border-[#dfdedf]/60 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <h4 className="text-[11px] font-light text-[#455cab] tracking-wide">
                  Histórico de Notas Fiscais
                </h4>
                <span className="text-[9px] text-[#171f38]/35 font-light">
                  {filtered.length} {filtered.length === 1 ? "nota" : "notas"}
                </span>
              </div>
              {filterOptions.length > 1 && (
                <select
                  value={filterVal}
                  onChange={(e) => handleFilterChange(e.target.value)}
                  className="text-[10px] font-light text-[#455cab]/70 bg-[#f1f1f1] border border-[#dfdedf] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#455cab]/40 transition-colors cursor-pointer"
                >
                  <option value="">Todos os meses</option>
                  {filterOptions.map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Linhas */}
            {pageRows.length === 0 ? (
              <div className="py-10 flex flex-col items-center justify-center gap-2">
                <FileText size={16} className="text-[#455cab]/20" />
                <p className="text-[11px] font-light text-[#171f38]/40">
                  Nenhuma nota neste período
                </p>
              </div>
            ) : (
              pageRows.map((inv, i) => (
                <div
                  key={inv.id}
                  className={cn(
                    "flex items-center gap-4 px-4 py-3.5 hover:bg-[#455cab]/[0.02] transition-colors",
                    i < pageRows.length - 1 && "border-b border-[#dfdedf]/60"
                  )}
                >
                  <FileText size={13} className="text-[#455cab]/40 shrink-0" />

                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-light text-[#171f38] truncate">{inv.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {inv.referenceMonth && (
                        <span className="text-[10px] text-[#171f38]/50 font-light">
                          {fmtRefMonth(inv.referenceMonth)}
                        </span>
                      )}
                      {inv.invoiceNumber && (
                        <span className="text-[10px] text-[#171f38]/35 font-light">
                          · NF {inv.invoiceNumber}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {inv.amount != null && (
                      <span className="text-[11px] font-light text-[#455cab] tabular-nums hidden sm:block">
                        {fmtCurrency(inv.amount)}
                      </span>
                    )}
                    <span className="text-[10px] text-[#171f38]/35 font-light hidden sm:block">
                      {fmtDate(inv.issuedAt ?? inv.createdAt)}
                    </span>
                    {inv.fileSize != null && (
                      <span className="text-[9px] text-[#171f38]/25 font-light hidden md:block">
                        {fmtFileSize(inv.fileSize)}
                      </span>
                    )}
                    {downloadUrls[inv.id] ? (
                      <a
                        href={downloadUrls[inv.id]!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#dfdedf] text-[10px] font-light text-[#455cab]/60 hover:border-[#455cab]/40 hover:text-[#455cab] transition-all"
                      >
                        <Download size={10} />
                        Baixar
                      </a>
                    ) : (
                      <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#dfdedf]/40 text-[10px] font-light text-[#171f38]/20 select-none">
                        <Download size={10} />
                        Baixar
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-3 px-1">
              <span className="text-[10px] text-[#171f38]/40 font-light">
                Página {safePage} de {totalPages}
              </span>
              <div className="flex items-center gap-2">
                {safePage > 1 ? (
                  <button
                    onClick={() => setPage(safePage - 1)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#dfdedf] text-[10px] font-light text-[#455cab]/60 hover:text-[#455cab] hover:border-[#455cab]/40 transition-all"
                  >
                    <ChevronLeft size={11} />
                    Anterior
                  </button>
                ) : (
                  <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#dfdedf]/40 text-[10px] font-light text-[#171f38]/20 select-none">
                    <ChevronLeft size={11} />
                    Anterior
                  </span>
                )}
                {safePage < totalPages ? (
                  <button
                    onClick={() => setPage(safePage + 1)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#dfdedf] text-[10px] font-light text-[#455cab]/60 hover:text-[#455cab] hover:border-[#455cab]/40 transition-all"
                  >
                    Próxima
                    <ChevronRight size={11} />
                  </button>
                ) : (
                  <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#dfdedf]/40 text-[10px] font-light text-[#171f38]/20 select-none">
                    Próxima
                    <ChevronRight size={11} />
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClientPaymentRow } from "@/lib/data/invoices-client";

// ── Constantes ────────────────────────────────────────────────────────────────

const MONTHS_PT = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];
const PER_PAGE = 10;

// ── Formatadores ──────────────────────────────────────────────────────────────

function fmtCurrency(v: number, currency = "BRL"): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency });
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
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

const STATUS_LABEL: Record<string, string> = {
  paid:      "Pago",
  cancelled: "Cancelado",
  overdue:   "Vencido",
  failed:    "Falhou",
  pending:   "Pendente",
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  payments: ClientPaymentRow[];
  downloadUrls: Record<string, string | null>;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PaymentHistorySection({ payments, downloadUrls }: Props) {
  const [filterVal, setFilterVal] = useState("");
  const [page, setPage] = useState(1);

  // Opções de filtro por mês/ano de paid_at ou due_date
  const filterMap = new Map<string, string>();
  for (const p of payments) {
    const src = p.paidAt ?? p.dueDate ?? p.createdAt;
    if (!src) continue;
    const d = new Date(src);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const key = `${year}-${String(month).padStart(2, "0")}`;
    if (!filterMap.has(key)) {
      filterMap.set(key, `${MONTHS_PT[month - 1]} ${year}`);
    }
  }
  const filterOptions = [...filterMap.entries()];

  function handleFilter(val: string) {
    setFilterVal(val);
    setPage(1);
  }

  // Filtrar
  const filtered = filterVal
    ? payments.filter((p) => {
        const src = p.paidAt ?? p.dueDate ?? p.createdAt;
        if (!src) return false;
        const d = new Date(src);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        return key === filterVal;
      })
    : payments;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage   = Math.min(page, totalPages);
  const pageRows   = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  return (
    <div className="rounded-2xl border border-white bg-white/60 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] overflow-hidden">
      {/* Cabeçalho */}
      <div className="px-4 py-3.5 border-b border-slate-200/60 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <h4 className="text-[11px] font-light text-[#455cab] tracking-wide">
            Histórico de Pagamentos
          </h4>
          <span className="text-[9px] text-[#171f38]/35 font-light">
            {filtered.length} {filtered.length === 1 ? "registro" : "registros"}
          </span>
        </div>
        {filterOptions.length > 1 && (
          <select
            value={filterVal}
            onChange={(e) => handleFilter(e.target.value)}
            className="text-[10px] font-light text-vitti-blue/70 bg-white/70 border border-slate-200/60 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-vitti-blue/40 transition-colors cursor-pointer"
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
          <CreditCard size={16} className="text-[#455cab]/20" />
          <p className="text-[11px] font-light text-[#171f38]/40">
            {filterVal ? "Nenhum registro neste período" : "Nenhum pagamento registrado"}
          </p>
        </div>
      ) : (
        pageRows.map((p, i) => {
          const receiptUrl = downloadUrls[p.id] ?? p.receiptUrl ?? null;
          return (
            <div
              key={p.id}
              className={cn(
                "flex items-center gap-4 px-4 py-3.5 hover:bg-slate-50/80 transition-colors",
                i < pageRows.length - 1 && "border-b border-slate-200/60"
              )}
            >
              <CreditCard size={13} className="text-[#455cab]/40 shrink-0" />

              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-light text-[#171f38] truncate">{p.title}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {p.referenceMonth && (
                    <span className="text-[10px] text-[#171f38]/50 font-light">
                      {fmtRefMonth(p.referenceMonth)}
                    </span>
                  )}
                  <span
                    className={cn(
                      "text-[9px] font-light px-1.5 py-0.5 rounded",
                      p.status === "paid"
                        ? "bg-emerald-50 text-emerald-600/70"
                        : "bg-[#171f38]/[0.05] text-[#171f38]/45"
                    )}
                  >
                    {STATUS_LABEL[p.status] ?? p.status}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right hidden sm:block">
                  <p className="text-[11px] font-light text-[#455cab] tabular-nums">
                    {fmtCurrency(p.amount, p.currency)}
                  </p>
                  {p.paidAt ? (
                    <p className="text-[9px] text-[#171f38]/35 font-light">
                      Pago em {fmtDate(p.paidAt)}
                    </p>
                  ) : (
                    <p className="text-[9px] text-[#171f38]/35 font-light">
                      Venc. {fmtDate(p.dueDate)}
                    </p>
                  )}
                </div>
                {receiptUrl ? (
                  <a
                    href={receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-[10px] font-light text-[#455cab]/60 hover:border-[#455cab]/40 hover:text-[#455cab] transition-all"
                  >
                    <Download size={10} />
                    Comprovante
                  </a>
                ) : (
                  <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200/40 text-[10px] font-light text-[#171f38]/20 select-none">
                    <Download size={10} />
                    Comprovante
                  </span>
                )}
              </div>
            </div>
          );
        })
      )}

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200/60">
          <span className="text-[10px] text-[#171f38]/40 font-light">
            Página {safePage} de {totalPages}
          </span>
          <div className="flex items-center gap-2">
            {safePage > 1 ? (
              <button
                onClick={() => setPage(safePage - 1)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-[10px] font-light text-[#455cab]/60 hover:text-[#455cab] hover:border-[#455cab]/40 transition-all"
              >
                <ChevronLeft size={11} />
                Anterior
              </button>
            ) : (
              <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200/40 text-[10px] font-light text-[#171f38]/20 select-none">
                <ChevronLeft size={11} />
                Anterior
              </span>
            )}
            {safePage < totalPages ? (
              <button
                onClick={() => setPage(safePage + 1)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-[10px] font-light text-[#455cab]/60 hover:text-[#455cab] hover:border-[#455cab]/40 transition-all"
              >
                Próxima
                <ChevronRight size={11} />
              </button>
            ) : (
              <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200/40 text-[10px] font-light text-[#171f38]/20 select-none">
                Próxima
                <ChevronRight size={11} />
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

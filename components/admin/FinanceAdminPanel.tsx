"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  FileText,
  Search,
  X,
  Plus,
  Loader2,
  ExternalLink,
  Pencil,
} from "lucide-react";
import type { AdminInvoiceRow, InvoiceStatus } from "@/lib/data/invoices-admin";
import type { AdminClientRow } from "@/lib/data/clients-admin";
import type { InvoiceListResponse, InvoiceCreateResponse } from "@/app/api/admin/finance/invoices/route";
import type { InvoicePatchResponse } from "@/app/api/admin/finance/invoices/[id]/route";

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  emitida:   "Emitida",
  pendente:  "Pendente",
  cancelada: "Cancelada",
};

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  emitida:   "border-emerald-400/30 text-emerald-400/70 bg-emerald-400/5",
  pendente:  "border-amber-400/30 text-amber-400/70 bg-amber-400/5",
  cancelada: "border-white/[0.08] text-white/25 bg-white/[0.02]",
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatCurrency(amount: number | null): string {
  if (amount === null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
}

function formatDate(date: string | null): string {
  if (!date) return "—";
  const parts = date.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return date;
}

// ── BackToAdmin ────────────────────────────────────────────────────────────────

export function BackToAdmin() {
  return (
    <Link
      href="/admin"
      className="inline-flex items-center gap-1.5 text-[10px] font-light text-white/30 hover:text-white/60 transition-colors"
    >
      <ArrowLeft size={11} />
      Admin
    </Link>
  );
}

// ── StatusBadge ────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <span className={`text-[8px] font-light px-2 py-0.5 rounded-full border ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

// ── Invoice row ────────────────────────────────────────────────────────────────

function InvoiceRow({
  invoice,
  onEdit,
}: {
  invoice: AdminInvoiceRow;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/[0.05] bg-white/[0.02] hover:border-white/[0.10] hover:bg-white/[0.03] transition-all">
      <div className="w-7 h-7 rounded-lg bg-white/[0.02] border border-white/[0.06] flex items-center justify-center shrink-0">
        <FileText size={12} className="text-vitti-light/30" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[12px] font-light text-white/80 truncate">{invoice.title}</span>
          <StatusBadge status={invoice.status} />
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          <span className="text-[10px] font-light text-white/40">{invoice.competence}</span>
          <span className="text-[10px] font-light text-white/25">{formatDate(invoice.issuedAt)}</span>
          {invoice.amount !== null && (
            <span className="text-[10px] font-light text-vitti-light/50">
              {formatCurrency(invoice.amount)}
            </span>
          )}
          {invoice.nfUrl && (
            <a
              href={invoice.nfUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-[9px] font-light text-vitti-light/40 hover:text-vitti-light/70 transition-colors"
            >
              <ExternalLink size={9} />
              Ver NF
            </a>
          )}
        </div>
      </div>

      <button
        onClick={onEdit}
        className="shrink-0 flex items-center gap-1.5 text-[9px] font-light text-white/20 hover:text-vitti-light/70 transition-colors px-2 py-1 rounded-lg hover:bg-white/[0.04]"
      >
        <Pencil size={9} />
        Editar
      </button>
    </div>
  );
}

// ── Invoice modal (create / edit) ──────────────────────────────────────────────

function InvoiceModal({
  invoice,
  clientId,
  onClose,
  onSaved,
}: {
  invoice: AdminInvoiceRow | null;
  clientId: string;
  onClose: () => void;
  onSaved: (saved: AdminInvoiceRow) => void;
}) {
  const isNew = invoice === null;

  const [title, setTitle] = useState(invoice?.title ?? "");
  const [competence, setCompetence] = useState(invoice?.competence ?? "");
  const [issuedAt, setIssuedAt] = useState(invoice?.issuedAt ?? "");
  const [status, setStatus] = useState<InvoiceStatus>(invoice?.status ?? "emitida");
  const [amount, setAmount] = useState(invoice?.amount != null ? String(invoice.amount) : "");
  const [nfUrl, setNfUrl] = useState(invoice?.nfUrl ?? "");
  const [notes, setNotes] = useState(invoice?.notes ?? "");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    if (!title.trim()) { setValidationError("Título é obrigatório."); return; }
    if (!competence.trim()) { setValidationError("Competência é obrigatória."); return; }
    setValidationError(null);
    setSaveState("saving");

    const body: Record<string, unknown> = {
      title: title.trim(),
      competence: competence.trim(),
      issuedAt: issuedAt || null,
      status,
      amount: amount ? Number(amount) : null,
      nfUrl: nfUrl.trim() || null,
      notes: notes.trim() || null,
    };

    try {
      if (isNew) {
        body.clientId = clientId;
        const res = await fetch("/api/admin/finance/invoices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json: InvoiceCreateResponse = await res.json();
        if (!json.success || !json.invoice) throw new Error(json.error ?? "Erro ao criar NF.");
        setSaveState("saved");
        const saved = json.invoice;
        setTimeout(() => onSaved(saved), 600);
      } else {
        const res = await fetch(`/api/admin/finance/invoices/${invoice!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json: InvoicePatchResponse = await res.json();
        if (!json.success || !json.invoice) throw new Error(json.error ?? "Erro ao atualizar NF.");
        setSaveState("saved");
        const saved = json.invoice;
        setTimeout(() => onSaved(saved), 600);
      }
    } catch {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 3000);
    }
  }, [isNew, title, competence, issuedAt, status, amount, nfUrl, notes, clientId, invoice, onSaved]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-end"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative w-full max-w-md h-full bg-[#0d1117] border-l border-white/[0.06] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-white/[0.06] bg-[#0d1117]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
              <FileText size={11} className="text-vitti-light/40" />
            </div>
            <p className="text-[11px] font-light text-white/70">
              {isNew ? "Nova Nota Fiscal" : "Editar Nota Fiscal"}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.04] transition-colors">
            <X size={13} className="text-white/30" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 px-5 py-4 space-y-4">
          {validationError && (
            <p className="text-[10px] font-light text-red-400/70">{validationError}</p>
          )}

          {/* Título */}
          <div>
            <label className="text-[9px] font-light text-white/30 block mb-1">Título *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Serviços de Marketing Digital"
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-[11px] font-light text-white/70 placeholder-white/20 focus:outline-none focus:border-vitti-medium/40 transition-colors"
            />
          </div>

          {/* Competência */}
          <div>
            <label className="text-[9px] font-light text-white/30 block mb-1">Competência *</label>
            <input
              type="text"
              value={competence}
              onChange={(e) => setCompetence(e.target.value)}
              placeholder="Ex: Maio/2026"
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-[11px] font-light text-white/70 placeholder-white/20 focus:outline-none focus:border-vitti-medium/40 transition-colors"
            />
          </div>

          {/* Data + Valor */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] font-light text-white/30 block mb-1">Data de emissão</label>
              <input
                type="date"
                value={issuedAt}
                onChange={(e) => setIssuedAt(e.target.value)}
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-[11px] font-light text-white/60 focus:outline-none focus:border-vitti-medium/40 transition-colors"
              />
            </div>
            <div>
              <label className="text-[9px] font-light text-white/30 block mb-1">Valor (R$)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-[11px] font-light text-white/70 placeholder-white/20 focus:outline-none focus:border-vitti-medium/40 transition-colors"
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="text-[9px] font-light text-white/30 block mb-1.5">Status</label>
            <div className="flex gap-2 flex-wrap">
              {(["emitida", "pendente", "cancelada"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`text-[9px] font-light px-3 py-1.5 rounded-full border transition-all ${
                    status === s
                      ? STATUS_STYLES[s]
                      : "border-white/[0.08] text-white/25 hover:border-white/20"
                  }`}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Link da NF */}
          <div>
            <label className="text-[9px] font-light text-white/30 block mb-1">
              Link da NF <span className="text-white/15">(opcional)</span>
            </label>
            <input
              type="url"
              value={nfUrl}
              onChange={(e) => setNfUrl(e.target.value)}
              placeholder="https://…"
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-[11px] font-light text-white/70 placeholder-white/20 focus:outline-none focus:border-vitti-medium/40 transition-colors"
            />
          </div>

          {/* Observação / texto da NF */}
          <div>
            <label className="text-[9px] font-light text-white/30 block mb-1">
              Observação / Texto da NF <span className="text-white/15">(opcional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Cole aqui o texto da nota fiscal ou adicione uma observação…"
              rows={5}
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-[11px] font-light text-white/70 placeholder-white/20 focus:outline-none focus:border-vitti-medium/40 transition-colors resize-none"
            />
          </div>

          {/* Save */}
          <div className="flex justify-end pt-1">
            <button
              onClick={handleSave}
              disabled={saveState === "saving"}
              className={`text-[9px] font-light px-4 py-2 rounded-full border transition-all disabled:cursor-not-allowed ${
                saveState === "saved"
                  ? "border-emerald-400/30 text-emerald-400/70 bg-emerald-400/5"
                  : saveState === "error"
                    ? "border-red-400/30 text-red-400/60 bg-red-400/5"
                    : "border-vitti-medium/40 text-vitti-light/60 hover:border-vitti-medium/70 hover:text-vitti-light/90 disabled:opacity-40"
              }`}
            >
              {saveState === "saving" ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 size={9} className="animate-spin" />
                  Salvando…
                </span>
              ) : saveState === "saved" ? (
                "Salvo!"
              ) : saveState === "error" ? (
                "Erro — tentar novamente"
              ) : isNew ? (
                "Criar NF"
              ) : (
                "Salvar alterações"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────────

export function FinanceAdminPanel({ allClients }: { allClients: AdminClientRow[] }) {
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [invoices, setInvoices] = useState<AdminInvoiceRow[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<AdminInvoiceRow | "new" | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | InvoiceStatus>("all");

  const handleClientSelect = useCallback((clientId: string) => {
    setSelectedClientId(clientId);
    setSearchQuery("");
    setStatusFilter("all");
    setInvoices([]);
    if (!clientId) return;
    setLoadingInvoices(true);
    fetch(`/api/admin/finance/invoices?clientId=${encodeURIComponent(clientId)}`)
      .then((r) => r.json())
      .then((json: InvoiceListResponse) => setInvoices(json.invoices ?? []))
      .catch(() => setInvoices([]))
      .finally(() => setLoadingInvoices(false));
  }, []);

  const handleSaved = useCallback((saved: AdminInvoiceRow) => {
    setInvoices((prev) => {
      const idx = prev.findIndex((i) => i.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    setEditingInvoice(null);
  }, []);

  const filtered = invoices.filter((inv) => {
    const q = searchQuery.toLowerCase();
    const matchQ =
      !q ||
      inv.title.toLowerCase().includes(q) ||
      inv.competence.toLowerCase().includes(q);
    const matchS = statusFilter === "all" || inv.status === statusFilter;
    return matchQ && matchS;
  });

  const selectedClient = allClients.find((c) => c.id === selectedClientId);

  return (
    <div className="space-y-5">
      {/* Client selector + Nova NF */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[220px]">
          <select
            value={selectedClientId}
            onChange={(e) => handleClientSelect(e.target.value)}
            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-[11px] font-light text-white/70 focus:outline-none focus:border-vitti-medium/30 transition-colors appearance-none"
          >
            <option value="">Selecionar cliente…</option>
            {allClients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.status !== "active" ? " (inativo)" : ""}
              </option>
            ))}
          </select>
        </div>

        {selectedClientId && (
          <button
            onClick={() => setEditingInvoice("new")}
            className="flex items-center gap-1.5 text-[9px] font-light px-3 py-2 rounded-full border border-vitti-medium/30 text-vitti-light/60 hover:border-vitti-medium/60 hover:text-vitti-light/90 transition-all"
          >
            <Plus size={10} />
            Nova NF
          </button>
        )}
      </div>

      {/* Empty — no client selected */}
      {!selectedClientId && (
        <div className="flex flex-col items-center gap-2 py-16">
          <FileText size={24} className="text-white/10" />
          <p className="text-[11px] font-light text-white/20">
            Selecione um cliente para visualizar e gerenciar as notas fiscais.
          </p>
        </div>
      )}

      {/* Loading */}
      {selectedClientId && loadingInvoices && (
        <div className="flex items-center gap-2 py-10 justify-center text-white/30">
          <Loader2 size={14} className="animate-spin" />
          <span className="text-[11px] font-light">Carregando…</span>
        </div>
      )}

      {/* Invoice list */}
      {selectedClientId && !loadingInvoices && (
        <div className="space-y-4">
          {/* Search + status filter */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={11} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por título ou competência…"
                className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl pl-8 pr-3 py-2.5 text-[11px] font-light text-white/70 placeholder-white/20 focus:outline-none focus:border-vitti-medium/30 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X size={10} className="text-white/30 hover:text-white/60" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1">
              {(["all", "emitida", "pendente", "cancelada"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`text-[9px] font-light px-2.5 py-1.5 rounded-full border transition-all ${
                    statusFilter === s
                      ? "border-vitti-medium/50 text-vitti-light/70 bg-vitti-medium/10"
                      : "border-white/[0.07] text-white/25 hover:border-white/15"
                  }`}
                >
                  {s === "all" ? "Todos" : STATUS_LABELS[s as InvoiceStatus]}
                </button>
              ))}
            </div>

            <span className="text-[9px] font-light text-white/20 ml-auto">
              {filtered.length} de {invoices.length}
            </span>
          </div>

          {/* Empty — no invoices */}
          {invoices.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-12">
              <FileText size={22} className="text-white/10" />
              <p className="text-[11px] font-light text-white/20">
                Nenhuma NF cadastrada para{" "}
                {selectedClient?.name ?? "este cliente"}.
              </p>
              <button
                onClick={() => setEditingInvoice("new")}
                className="mt-1 text-[9px] font-light px-3 py-1.5 rounded-full border border-vitti-medium/25 text-vitti-light/50 hover:border-vitti-medium/50 hover:text-vitti-light/80 transition-all"
              >
                + Criar primeira NF
              </button>
            </div>
          )}

          {/* Empty — filtered */}
          {invoices.length > 0 && filtered.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10">
              <p className="text-[11px] font-light text-white/20">
                Nenhuma NF encontrada com esses filtros.
              </p>
            </div>
          )}

          {/* Invoice rows */}
          {filtered.length > 0 && (
            <div className="space-y-2">
              {filtered.map((inv) => (
                <InvoiceRow
                  key={inv.id}
                  invoice={inv}
                  onEdit={() => setEditingInvoice(inv)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Note */}
      <div className="rounded-xl border border-white/[0.04] bg-white/[0.01] px-4 py-3">
        <p className="text-[9px] font-light text-white/25 leading-relaxed">
          <span className="text-white/40">Notas fiscais manuais</span> — insira o título,
          competência e cole o link ou texto da NF. Boletos, cobranças automáticas e
          integrações bancárias ficam para sprint futura.
        </p>
      </div>

      {/* Modal */}
      {editingInvoice !== null && (
        <InvoiceModal
          invoice={editingInvoice === "new" ? null : editingInvoice}
          clientId={selectedClientId}
          onClose={() => setEditingInvoice(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

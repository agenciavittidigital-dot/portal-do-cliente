"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Barcode,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { AdminPaymentRow, PaymentStatus } from "@/lib/data/payments-admin";
import type {
  PaymentListResponse,
  PaymentCreateResponse,
} from "@/app/api/admin/finance/payments/route";
import type {
  PaymentPatchResponse,
  PaymentDeleteResponse,
} from "@/app/api/admin/finance/payments/[id]/route";

// ── Constants ──────────────────────────────────────────────────────────────────

const MONTHS_PT = [
  "Jan","Fev","Mar","Abr","Mai","Jun",
  "Jul","Ago","Set","Out","Nov","Dez",
];

const STATUS_LABELS: Record<PaymentStatus, string> = {
  pending:   "Pendente",
  overdue:   "Vencido",
  paid:      "Pago",
  cancelled: "Cancelado",
  failed:    "Falhou",
};

const STATUS_STYLES: Record<PaymentStatus, string> = {
  pending:   "border-amber-400/30 text-amber-500/70 bg-amber-400/5",
  overdue:   "border-red-400/30 text-red-500/70 bg-red-400/5",
  paid:      "border-emerald-400/30 text-emerald-600/70 bg-emerald-400/5",
  cancelled: "border-black/[0.08] text-[#5F6368]/55 bg-black/[0.02]",
  failed:    "border-red-400/20 text-red-400/60 bg-red-400/[0.03]",
};

const ACCEPTED_TYPES = "application/pdf,image/png,image/jpeg";
const HISTORY_PER_PAGE = 10;

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtCurrency(amount: number, currency = "BRL"): string {
  return amount.toLocaleString("pt-BR", { style: "currency", currency });
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const parts = iso.split("T")[0].split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return iso;
}

function fmtRefMonth(dateStr: string | null): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length >= 2) {
    const month = MONTHS_PT[parseInt(parts[1], 10) - 1] ?? parts[1];
    return `${month}/${parts[0]}`;
  }
  return dateStr;
}

function fmtFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Dark-panel style tokens (same as InvoiceModal) ────────────────────────────

const D = {
  label:    "text-[9px] font-light text-white/50 block mb-1",
  labelOpt: "text-white/25",
  input:    "w-full bg-white/[0.07] border border-white/15 rounded-lg px-3 py-2 text-[11px] font-light text-white/85 placeholder-white/30 focus:outline-none focus:border-[#638ACC]/50 transition-colors",
  inputDate:"w-full bg-white/[0.07] border border-white/15 rounded-lg px-3 py-2 text-[11px] font-light text-white/75 focus:outline-none focus:border-[#638ACC]/50 transition-colors",
  textarea: "w-full bg-white/[0.07] border border-white/15 rounded-lg px-3 py-2 text-[11px] font-light text-white/85 placeholder-white/30 focus:outline-none focus:border-[#638ACC]/50 transition-colors resize-none",
};

// ── StatusBadge ────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <span className={`text-[8px] font-light px-2 py-0.5 rounded-full border ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

// ── PaymentAdminRow ────────────────────────────────────────────────────────────

function PaymentAdminRow({
  payment,
  markingPaid,
  onMarkPaid,
  onEdit,
  onDelete,
}: {
  payment: AdminPaymentRow;
  markingPaid: boolean;
  onMarkPaid: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isPending = payment.status === "pending" || payment.status === "overdue";

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-black/[0.06] bg-black/[0.02] hover:border-black/[0.10] hover:bg-black/[0.03] transition-all">
      <div className="w-7 h-7 rounded-lg bg-black/[0.02] border border-black/[0.07] flex items-center justify-center shrink-0">
        <Barcode size={12} className="text-vitti-light/30" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[12px] font-light text-[#111111]/90 truncate">{payment.title}</span>
          <StatusBadge status={payment.status} />
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          {payment.referenceMonth && (
            <span className="text-[10px] font-light text-[#5F6368]/70">{fmtRefMonth(payment.referenceMonth)}</span>
          )}
          <span className="text-[10px] font-light text-vitti-light/50">{fmtCurrency(payment.amount, payment.currency)}</span>
          <span className="text-[10px] font-light text-[#5F6368]/55">Venc. {fmtDate(payment.dueDate)}</span>
          {payment.paidAt && (
            <span className="text-[10px] font-light text-emerald-600/60">Pago em {fmtDate(payment.paidAt)}</span>
          )}
        </div>
      </div>

      <div className="shrink-0 flex items-center gap-1">
        {payment.boletoFilePath && (
          <a
            href={`/api/admin/finance/payments/${payment.id}/download`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[9px] font-light text-vitti-light/30 hover:text-vitti-light/70 transition-colors px-2 py-1 rounded-lg hover:bg-black/[0.04]"
          >
            <Download size={9} />
            Boleto
          </a>
        )}
        {isPending && (
          <button
            onClick={onMarkPaid}
            disabled={markingPaid}
            className="flex items-center gap-1 text-[9px] font-light text-emerald-600/50 hover:text-emerald-600/90 transition-colors px-2 py-1 rounded-lg hover:bg-emerald-400/[0.06] disabled:opacity-40"
          >
            {markingPaid ? <Loader2 size={9} className="animate-spin" /> : <Check size={9} />}
            Pago
          </button>
        )}
        <button
          onClick={onEdit}
          className="flex items-center gap-1 text-[9px] font-light text-[#5F6368]/50 hover:text-vitti-light/70 transition-colors px-2 py-1 rounded-lg hover:bg-black/[0.04]"
        >
          <Pencil size={9} />
          Editar
        </button>
        <button
          onClick={onDelete}
          className="flex items-center gap-1 text-[9px] font-light text-red-400/40 hover:text-red-500/70 transition-colors px-2 py-1 rounded-lg hover:bg-red-400/[0.04]"
        >
          <Trash2 size={9} />
          Excluir
        </button>
      </div>
    </div>
  );
}

// ── PaymentHistoryAdminSection ─────────────────────────────────────────────────

function PaymentHistoryAdminSection({
  payments,
  markingPaidId,
  onEdit,
  onDelete,
}: {
  payments: AdminPaymentRow[];
  markingPaidId: string | null;
  onEdit: (p: AdminPaymentRow) => void;
  onDelete: (p: AdminPaymentRow) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(1);

  if (payments.length === 0) return null;

  const totalPages = Math.max(1, Math.ceil(payments.length / HISTORY_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageRows = payments.slice((safePage - 1) * HISTORY_PER_PAGE, safePage * HISTORY_PER_PAGE);

  return (
    <div className="mt-3">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 text-[10px] font-light text-[#5F6368]/60 hover:text-[#111111]/75 transition-colors"
      >
        {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        {expanded ? "Ocultar histórico" : "Ver histórico"}
        <span className="text-[9px] text-[#5F6368]/40 font-light ml-0.5">
          ({payments.length} {payments.length === 1 ? "pagamento" : "pagamentos"})
        </span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {pageRows.map((p) => (
            <PaymentAdminRow
              key={p.id}
              payment={p}
              markingPaid={markingPaidId === p.id}
              onMarkPaid={() => {}}
              onEdit={() => onEdit(p)}
              onDelete={() => onDelete(p)}
            />
          ))}

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-1 px-1">
              <span className="text-[9px] text-[#5F6368]/45 font-light">Página {safePage} de {totalPages}</span>
              <div className="flex items-center gap-2">
                {safePage > 1 ? (
                  <button
                    onClick={() => setPage(safePage - 1)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-black/[0.07] text-[9px] font-light text-[#5F6368]/60 hover:text-[#111111]/75 transition-all"
                  >
                    <ChevronLeft size={10} />Anterior
                  </button>
                ) : (
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-black/[0.04] text-[9px] font-light text-[#5F6368]/25 select-none">
                    <ChevronLeft size={10} />Anterior
                  </span>
                )}
                {safePage < totalPages ? (
                  <button
                    onClick={() => setPage(safePage + 1)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-black/[0.07] text-[9px] font-light text-[#5F6368]/60 hover:text-[#111111]/75 transition-all"
                  >
                    Próxima<ChevronRight size={10} />
                  </button>
                ) : (
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-black/[0.04] text-[9px] font-light text-[#5F6368]/25 select-none">
                    Próxima<ChevronRight size={10} />
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

// ── ConfirmDeletePaymentModal ──────────────────────────────────────────────────

function ConfirmDeletePaymentModal({
  payment,
  isDeleting,
  deleteError,
  onCancel,
  onConfirm,
}: {
  payment: AdminPaymentRow;
  isDeleting: boolean;
  deleteError: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={!isDeleting ? onCancel : undefined} />
      <div className="relative bg-white rounded-2xl border border-black/[0.08] shadow-[0_20px_60px_rgb(0,0,0,0.15)] p-6 max-w-sm w-full mx-4 space-y-4">
        <div>
          <p className="text-[13px] font-light text-[#111111]/85">Excluir boleto</p>
          <p className="text-[11px] font-light text-[#5F6368]/70 mt-1.5 leading-relaxed">
            Tem certeza que deseja excluir{" "}
            <span className="text-[#111111]/70">&ldquo;{payment.title}&rdquo;</span>
            ? Esta ação não poderá ser desfeita.
          </p>
        </div>
        {deleteError && (
          <p className="text-[10px] font-light text-red-500/70">{deleteError}</p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="text-[10px] font-light px-4 py-2 rounded-full border border-black/[0.08] text-[#5F6368]/70 hover:border-black/[0.15] hover:text-[#111111]/75 transition-all disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="text-[10px] font-light px-4 py-2 rounded-full border border-red-400/40 text-red-500/70 hover:border-red-400/70 hover:text-red-500/90 hover:bg-red-400/[0.04] transition-all disabled:opacity-40 flex items-center gap-1.5"
          >
            {isDeleting ? (
              <><Loader2 size={9} className="animate-spin" />Excluindo…</>
            ) : (
              "Excluir"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PaymentModal (create / edit) ───────────────────────────────────────────────

function PaymentModal({
  payment,
  clientId,
  onClose,
  onSaved,
}: {
  payment: AdminPaymentRow | null;
  clientId: string;
  onClose: () => void;
  onSaved: (saved: AdminPaymentRow) => void;
}) {
  const isNew = payment === null;

  const [title, setTitle]                   = useState(payment?.title ?? "");
  const [description, setDescription]       = useState(payment?.description ?? "");
  const [referenceMonth, setReferenceMonth] = useState(payment?.referenceMonth?.slice(0, 7) ?? "");
  const [dueDate, setDueDate]               = useState(payment?.dueDate?.slice(0, 10) ?? "");
  const [amount, setAmount]                 = useState(payment?.amount ? String(payment.amount) : "");
  const [paymentMethod, setPaymentMethod]   = useState(
    payment?.paymentMethod && payment.paymentMethod !== "unknown"
      ? payment.paymentMethod
      : ""
  );
  const [digitableLine, setDigitableLine]   = useState(payment?.digitableLine ?? "");
  const [pixCode, setPixCode]               = useState(payment?.pixCode ?? "");
  const [boletoUrl, setBoletoUrl]           = useState(payment?.boletoUrl ?? "");
  const [selectedFile, setSelectedFile]     = useState<File | null>(null);
  const [saveState, setSaveState]           = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = useCallback(async () => {
    if (!title.trim()) { setValidationError("Título é obrigatório."); return; }
    const amountNum = Number(amount);
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      setValidationError("Valor deve ser maior que zero.");
      return;
    }
    if (!dueDate) { setValidationError("Data de vencimento é obrigatória."); return; }
    setValidationError(null);
    setSaveState("saving");

    try {
      if (isNew) {
        const fd = new FormData();
        fd.append("clientId", clientId);
        fd.append("title", title.trim());
        fd.append("amount", String(amountNum));
        fd.append("dueDate", dueDate);
        if (description.trim()) fd.append("description", description.trim());
        if (referenceMonth) fd.append("referenceMonth", `${referenceMonth}-01`);
        if (paymentMethod.trim()) fd.append("paymentMethod", paymentMethod.trim());
        if (digitableLine.trim()) fd.append("digitableLine", digitableLine.trim());
        if (pixCode.trim()) fd.append("pixCode", pixCode.trim());
        if (boletoUrl.trim()) fd.append("boletoUrl", boletoUrl.trim());
        if (selectedFile) fd.append("file", selectedFile);

        const res = await fetch("/api/admin/finance/payments", { method: "POST", body: fd });
        const json: PaymentCreateResponse = await res.json();
        if (!json.success || !json.payment) {
          const base = json.error ?? "Erro ao criar boleto.";
          setValidationError(json.detail ? `${base} — ${json.detail}` : base);
          setSaveState("idle");
          return;
        }
        setSaveState("saved");
        setTimeout(() => onSaved(json.payment!), 600);
      } else {
        const body: Record<string, unknown> = {
          title: title.trim(),
          description: description.trim() || null,
          referenceMonth: referenceMonth ? `${referenceMonth}-01` : null,
          amount: amountNum,
          dueDate,
          paymentMethod: paymentMethod.trim() || null,
          digitableLine: digitableLine.trim() || null,
          pixCode: pixCode.trim() || null,
          boletoUrl: boletoUrl.trim() || null,
        };
        const res = await fetch(`/api/admin/finance/payments/${payment!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json: PaymentPatchResponse = await res.json();
        if (!json.success || !json.payment) {
          setValidationError(json.error ?? "Erro ao atualizar boleto.");
          setSaveState("idle");
          return;
        }
        setSaveState("saved");
        setTimeout(() => onSaved(json.payment!), 600);
      }
    } catch {
      setValidationError("Não foi possível conectar ao servidor.");
      setSaveState("idle");
    }
  }, [
    isNew, title, description, referenceMonth, dueDate, amount,
    paymentMethod, digitableLine, pixCode, boletoUrl,
    selectedFile, clientId, payment, onSaved,
  ]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md h-full bg-[#0d1117] border-l border-white/[0.08] overflow-y-auto flex flex-col">

        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-white/[0.08] bg-[#0d1117]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-white/[0.06] border border-white/10 flex items-center justify-center">
              <Barcode size={11} className="text-white/50" />
            </div>
            <p className="text-[11px] font-light text-white/85">
              {isNew ? "Novo Boleto / Pagamento" : "Editar Boleto / Pagamento"}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.07] transition-colors">
            <X size={13} className="text-white/50" />
          </button>
        </div>

        <div className="flex-1 px-5 py-4 space-y-4">
          {validationError && (
            <p className="text-[10px] font-light text-red-400/80">{validationError}</p>
          )}

          <div>
            <label className={D.label}>Título *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Honorários Dezembro/2026" className={D.input} />
          </div>

          <div>
            <label className={D.label}>Descrição <span className={D.labelOpt}>(opcional)</span></label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Referência ou observação" className={D.input} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={D.label}>Competência <span className={D.labelOpt}>(opcional)</span></label>
              <input type="month" value={referenceMonth} onChange={(e) => setReferenceMonth(e.target.value)} className={D.inputDate} />
            </div>
            <div>
              <label className={D.label}>Vencimento *</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={D.inputDate} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={D.label}>Valor (R$) *</label>
              <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" className={D.input} />
            </div>
            <div>
              <label className={D.label}>Método <span className={D.labelOpt}>(opcional)</span></label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={D.input}>
                <option value="">Automático</option>
                <option value="boleto">Boleto</option>
                <option value="pix">PIX</option>
                <option value="credit_card">Cartão de crédito</option>
                <option value="bank_transfer">Transferência bancária</option>
                <option value="manual">Manual</option>
              </select>
            </div>
          </div>

          <div>
            <label className={D.label}>Linha digitável <span className={D.labelOpt}>(opcional)</span></label>
            <input type="text" value={digitableLine} onChange={(e) => setDigitableLine(e.target.value)} placeholder="0000.00000 00000.000000 00000.000000 0 00000000000000" className={D.input} />
          </div>

          <div>
            <label className={D.label}>PIX copia e cola <span className={D.labelOpt}>(opcional)</span></label>
            <textarea value={pixCode} onChange={(e) => setPixCode(e.target.value)} rows={2} placeholder="Código PIX…" className={D.textarea} />
          </div>

          <div>
            <label className={D.label}>Link do boleto <span className={D.labelOpt}>(opcional)</span></label>
            <input type="url" value={boletoUrl} onChange={(e) => setBoletoUrl(e.target.value)} placeholder="https://…" className={D.input} />
          </div>

          {isNew && (
            <div>
              <label className={D.label}>Arquivo <span className={D.labelOpt}>(PDF, PNG ou JPEG · máx 10 MB · opcional)</span></label>
              <div
                className="relative flex items-center gap-2 border border-dashed border-white/15 rounded-lg px-3 py-2.5 cursor-pointer hover:border-[#638ACC]/40 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={12} className="text-white/40 shrink-0" />
                <span className="text-[11px] font-light text-white/40 truncate">
                  {selectedFile ? selectedFile.name : "Clique para selecionar o arquivo…"}
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_TYPES}
                  className="sr-only"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                />
              </div>
              {selectedFile && (
                <p className="text-[9px] font-light text-white/35 mt-1">
                  {selectedFile.name} · {fmtFileSize(selectedFile.size)}
                </p>
              )}
            </div>
          )}

          {!isNew && payment?.boletoFilePath && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-white/10 bg-white/[0.04]">
              <Barcode size={11} className="text-white/40 shrink-0" />
              <p className="text-[10px] font-light text-white/65 flex-1 truncate">Arquivo de boleto anexado</p>
              <a
                href={`/api/admin/finance/payments/${payment.id}/download`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto text-[9px] font-light text-vitti-light/40 hover:text-vitti-light/70 transition-colors flex items-center gap-1"
              >
                <Download size={9} />Baixar
              </a>
            </div>
          )}

          <div className="flex justify-end pt-1">
            <button
              onClick={handleSave}
              disabled={saveState === "saving"}
              className={`text-[9px] font-light px-4 py-2 rounded-full border transition-all disabled:cursor-not-allowed ${
                saveState === "saved"
                  ? "border-emerald-400/30 text-emerald-400/70 bg-emerald-400/5"
                  : saveState === "error"
                  ? "border-red-400/30 text-red-400/60 bg-red-400/5"
                  : "border-[#638ACC]/50 text-white/60 hover:border-[#638ACC]/80 hover:text-white/90 disabled:opacity-40"
              }`}
            >
              {saveState === "saving" ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 size={9} className="animate-spin" />
                  {isNew ? "Salvando…" : "Atualizando…"}
                </span>
              ) : saveState === "saved" ? "Salvo!"
                : saveState === "error" ? "Erro — tentar novamente"
                : isNew ? "Criar boleto"
                : "Salvar alterações"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function PaymentsAdminSection({ clientId }: { clientId: string }) {
  const [payments, setPayments]               = useState<AdminPaymentRow[]>([]);
  const [loading, setLoading]                 = useState(false);
  const [fetchError, setFetchError]           = useState<string | null>(null);
  const [editingPayment, setEditingPayment]   = useState<AdminPaymentRow | "new" | null>(null);
  const [markingPaidId, setMarkingPaidId]     = useState<string | null>(null);
  const [deletingPayment, setDeletingPayment] = useState<AdminPaymentRow | null>(null);
  const [isDeleting, setIsDeleting]           = useState(false);
  const [deleteError, setDeleteError]         = useState<string | null>(null);

  const fetchPayments = useCallback((cid: string) => {
    setLoading(true);
    setFetchError(null);
    fetch(`/api/admin/finance/payments?clientId=${encodeURIComponent(cid)}`)
      .then((r) => r.json())
      .then((json: PaymentListResponse) => {
        if (!json.success) {
          setFetchError(json.error ?? "Erro ao carregar pagamentos.");
          setPayments([]);
        } else {
          setPayments(json.payments ?? []);
        }
      })
      .catch(() => setFetchError("Não foi possível conectar ao servidor."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!clientId) { setPayments([]); setFetchError(null); return; }
    fetchPayments(clientId);
  }, [clientId, fetchPayments]);

  const handleSaved = useCallback((saved: AdminPaymentRow) => {
    setPayments((prev) => {
      const idx = prev.findIndex((p) => p.id === saved.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next; }
      return [saved, ...prev];
    });
    setEditingPayment(null);
  }, []);

  const handleMarkPaid = useCallback(async (payment: AdminPaymentRow) => {
    setMarkingPaidId(payment.id);
    try {
      const res = await fetch(`/api/admin/finance/payments/${payment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_paid" }),
      });
      const json: PaymentPatchResponse = await res.json();
      if (json.success && json.payment) {
        setPayments((prev) => prev.map((p) => (p.id === payment.id ? json.payment! : p)));
      }
    } catch {
      // silent
    } finally {
      setMarkingPaidId(null);
    }
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deletingPayment) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/admin/finance/payments/${deletingPayment.id}`, { method: "DELETE" });
      const json: PaymentDeleteResponse = await res.json();
      if (!json.success) { setDeleteError(json.error ?? "Erro ao excluir boleto."); setIsDeleting(false); return; }
      setPayments((prev) => prev.filter((p) => p.id !== deletingPayment.id));
      setDeletingPayment(null);
    } catch {
      setDeleteError("Não foi possível conectar ao servidor.");
    } finally {
      setIsDeleting(false);
    }
  }, [deletingPayment]);

  if (!clientId) return null;

  const pendingPayments = payments.filter((p) => p.status === "pending" || p.status === "overdue");
  const historyPayments = payments.filter((p) => p.status === "paid" || p.status === "cancelled" || p.status === "failed");

  return (
    <>
      <div className="space-y-4 border-t border-black/[0.06] pt-5 mt-2">
        <div className="flex items-center justify-between">
          <p className="text-[9px] font-light text-[#5F6368]/55 tracking-[0.13em] uppercase">
            Pagamentos e Boletos
          </p>
          <button
            onClick={() => setEditingPayment("new")}
            className="flex items-center gap-1.5 text-[9px] font-light px-3 py-1.5 rounded-full border border-vitti-medium/30 text-vitti-light/60 hover:border-vitti-medium/60 hover:text-vitti-light/90 transition-all"
          >
            <Plus size={10} />
            Adicionar boleto
          </button>
        </div>

        {loading && (
          <div className="flex items-center gap-2 py-6 justify-center text-[#5F6368]/60">
            <Loader2 size={13} className="animate-spin" />
            <span className="text-[10px] font-light">Carregando…</span>
          </div>
        )}

        {!loading && fetchError && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-red-400/20 bg-red-400/[0.03]">
            <p className="text-[10px] font-light text-red-400/70 flex-1">{fetchError}</p>
            <button onClick={() => fetchPayments(clientId)} className="text-[9px] font-light text-[#5F6368]/60 hover:text-[#111111]/75 transition-colors">
              Tentar novamente
            </button>
          </div>
        )}

        {!loading && !fetchError && (
          <>
            {/* A pagar */}
            <div>
              <p className="text-[9px] font-light text-[#5F6368]/40 tracking-[0.10em] uppercase mb-2">
                A pagar
              </p>
              {pendingPayments.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 rounded-xl border border-dashed border-black/[0.07]">
                  <Barcode size={18} className="text-[#5F6368]/20" />
                  <p className="text-[10px] font-light text-[#5F6368]/45">
                    Nenhum boleto pendente para este cliente
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {pendingPayments.map((p) => (
                    <PaymentAdminRow
                      key={p.id}
                      payment={p}
                      markingPaid={markingPaidId === p.id}
                      onMarkPaid={() => handleMarkPaid(p)}
                      onEdit={() => setEditingPayment(p)}
                      onDelete={() => { setDeleteError(null); setDeletingPayment(p); }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Histórico */}
            <PaymentHistoryAdminSection
              payments={historyPayments}
              markingPaidId={markingPaidId}
              onEdit={(p) => setEditingPayment(p)}
              onDelete={(p) => { setDeleteError(null); setDeletingPayment(p); }}
            />
          </>
        )}
      </div>

      {editingPayment !== null && (
        <PaymentModal
          payment={editingPayment === "new" ? null : editingPayment}
          clientId={clientId}
          onClose={() => setEditingPayment(null)}
          onSaved={handleSaved}
        />
      )}

      {deletingPayment !== null && (
        <ConfirmDeletePaymentModal
          payment={deletingPayment}
          isDeleting={isDeleting}
          deleteError={deleteError}
          onCancel={() => { if (!isDeleting) setDeletingPayment(null); }}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </>
  );
}

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  FileText,
  Search,
  X,
  Plus,
  Loader2,
  Download,
  Pencil,
  Eye,
  EyeOff,
  Archive,
  AlertCircle,
  RefreshCw,
  Upload,
  ExternalLink,
  ChevronDown,
  Trash2,
} from "lucide-react";
import type { AdminReportRow, ReportStatus } from "@/lib/data/reports-admin";
import type { AdminClientRow } from "@/lib/data/clients-admin";
import type { ReportListResponse, ReportCreateResponse } from "@/app/api/admin/reports/route";
import type { ReportPatchResponse, ReportDeleteResponse } from "@/app/api/admin/reports/[id]/route";

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<ReportStatus, string> = {
  draft:     "Rascunho",
  published: "Publicado",
  archived:  "Arquivado",
};

const STATUS_STYLES: Record<ReportStatus, string> = {
  published: "border-emerald-400/30 text-emerald-400/70 bg-emerald-400/5",
  draft:     "border-amber-400/30 text-amber-400/70 bg-amber-400/5",
  archived:  "border-black/[0.08] text-[#5F6368]/55 bg-black/[0.02]",
};

const STATUS_ICONS: Record<ReportStatus, React.ElementType> = {
  published: Eye,
  draft:     EyeOff,
  archived:  Archive,
};

// Status styles inside dark drawer
const DRAWER_STATUS_STYLES: Record<ReportStatus, string> = {
  published: "border-emerald-400/40 text-emerald-400/80 bg-emerald-400/10",
  draft:     "border-amber-400/40 text-amber-400/80 bg-amber-400/10",
  archived:  "border-white/15 text-white/45 bg-white/[0.04]",
};

const ACCEPTED_TYPES = "application/pdf,image/png,image/jpeg";

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  if (!iso) return "—";
  const parts = iso.split("T")[0].split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return iso;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── BackToAdmin ────────────────────────────────────────────────────────────────

export function BackToAdmin() {
  return (
    <Link
      href="/admin"
      className="inline-flex items-center gap-1.5 text-[10px] font-light text-[#5F6368]/80 hover:text-[#111111]/90 transition-colors"
    >
      <ArrowLeft size={11} />
      Admin
    </Link>
  );
}

// ── ClientSelector ─────────────────────────────────────────────────────────────

function ClientSelector({
  allClients,
  selectedClientId,
  onSelect,
}: {
  allClients: AdminClientRow[];
  selectedClientId: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  const filtered = allClients.filter((c) =>
    c.name.toLowerCase().includes(query.toLowerCase())
  );

  const selected = allClients.find((c) => c.id === selectedClientId);

  return (
    <div ref={containerRef} className="relative flex-1 min-w-[220px]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 bg-white border border-black/[0.08] rounded-xl px-3 py-2.5 text-[11px] font-light text-left shadow-[0_1px_4px_rgb(0,0,0,0.04)] transition-colors hover:border-vitti-medium/30 focus:outline-none focus:border-vitti-medium/40"
      >
        <span className={selected ? "text-[#111111]/80" : "text-[#5F6368]/70"}>
          {selected
            ? `${selected.name}${selected.status !== "active" ? " (inativo)" : ""}`
            : "Selecionar cliente…"}
        </span>
        <ChevronDown
          size={12}
          className={`text-[#5F6368]/65 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-30 bg-white border border-black/[0.08] rounded-xl shadow-[0_8px_28px_rgb(0,0,0,0.10)] overflow-hidden">
          <div className="p-2 border-b border-black/[0.05]">
            <div className="relative">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5F6368]/40" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar cliente…"
                className="w-full pl-7 pr-3 py-1.5 text-[11px] font-light text-[#111111]/80 placeholder-[#5F6368]/40 bg-black/[0.02] border border-black/[0.06] rounded-lg focus:outline-none focus:border-vitti-medium/30"
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="text-[10px] font-light text-[#5F6368]/50 text-center py-4">
                Nenhum cliente encontrado.
              </p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onSelect(c.id);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={`w-full text-left px-3 py-2.5 text-[11px] font-light transition-colors hover:bg-vitti-blue/[0.04] ${
                    c.id === selectedClientId
                      ? "text-vitti-light/80 bg-vitti-blue/[0.03]"
                      : "text-[#111111]/75"
                  }`}
                >
                  {c.name}
                  {c.status !== "active" && (
                    <span className="ml-1.5 text-[9px] text-[#5F6368]/45">(inativo)</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── StatusBadge ────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ReportStatus }) {
  const Icon = STATUS_ICONS[status];
  return (
    <span className={`inline-flex items-center gap-1 text-[8px] font-light px-2 py-0.5 rounded-full border ${STATUS_STYLES[status]}`}>
      <Icon size={8} />
      {STATUS_LABELS[status]}
    </span>
  );
}

// ── DeleteConfirmModal ─────────────────────────────────────────────────────────

function DeleteConfirmModal({
  report,
  onCancel,
  onConfirm,
  isDeleting,
  deleteError,
}: {
  report: AdminReportRow;
  onCancel: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
  deleteError: string | null;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative w-full max-w-sm bg-white rounded-2xl border border-black/[0.07] shadow-[0_24px_64px_rgb(0,0,0,0.18)] p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
            <Trash2 size={13} className="text-red-400/80" />
          </div>
          <p className="text-[12px] font-light text-[#111111]/85">Excluir relatório</p>
        </div>

        <p className="text-[11px] font-light text-[#5F6368]/70 leading-relaxed">
          Tem certeza que deseja excluir{" "}
          <span className="text-[#111111]/80 font-normal">"{report.title}"</span>?
          Esta ação não poderá ser desfeita.
        </p>

        {deleteError && (
          <p className="text-[10px] font-light text-red-400/70">{deleteError}</p>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="text-[10px] font-light px-4 py-2 rounded-full border border-black/[0.08] text-[#5F6368]/60 hover:text-[#111111]/75 hover:border-black/[0.15] transition-all disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="text-[10px] font-light px-4 py-2 rounded-full border border-red-300/50 text-red-500/80 bg-red-50/50 hover:bg-red-50 hover:border-red-300 transition-all disabled:opacity-40 flex items-center gap-1.5"
          >
            {isDeleting ? (
              <>
                <Loader2 size={9} className="animate-spin" />
                Excluindo…
              </>
            ) : (
              <>
                <Trash2 size={9} />
                Excluir
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Report row ─────────────────────────────────────────────────────────────────

function ReportRow({
  report,
  onEdit,
  onDelete,
}: {
  report: AdminReportRow;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-black/[0.06] bg-white hover:border-black/[0.10] hover:bg-black/[0.01] transition-all">
      <div className="w-7 h-7 rounded-lg bg-slate-50 border border-black/[0.07] flex items-center justify-center shrink-0">
        <FileText size={12} className="text-vitti-medium/50" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[12px] font-light text-[#111111]/85 truncate">{report.title}</span>
          <StatusBadge status={report.status} />
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          <span className="text-[10px] font-light text-[#5F6368]/80">{report.period}</span>
          <span className="text-[10px] font-light text-[#5F6368]/60">{formatDate(report.createdAt)}</span>
          {report.fileName && (
            <span className="text-[10px] font-light text-[#5F6368]/55 truncate max-w-[140px]">
              {report.fileName}
              {report.fileSize ? ` · ${formatFileSize(report.fileSize)}` : ""}
            </span>
          )}
        </div>
        {report.summary && (
          <p className="text-[10px] font-light text-[#5F6368]/65 mt-1 truncate max-w-md">
            {report.summary}
          </p>
        )}
      </div>

      <div className="shrink-0 flex items-center gap-1">
        <a
          href={`/api/admin/reports/${report.id}/download`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[9px] font-light text-vitti-medium/60 hover:text-vitti-medium/90 transition-colors px-2 py-1 rounded-lg hover:bg-vitti-blue/[0.04]"
        >
          <Download size={9} />
          Baixar
        </a>
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 text-[9px] font-light text-[#5F6368]/65 hover:text-[#111111]/80 transition-colors px-2 py-1 rounded-lg hover:bg-black/[0.04]"
        >
          <Pencil size={9} />
          Editar
        </button>
        <button
          onClick={onDelete}
          className="flex items-center gap-1.5 text-[9px] font-light text-red-400/50 hover:text-red-500/80 transition-colors px-2 py-1 rounded-lg hover:bg-red-50/60"
        >
          <Trash2 size={9} />
          Excluir
        </button>
      </div>
    </div>
  );
}

// ── Report modal (create / edit) ───────────────────────────────────────────────

function ReportModal({
  report,
  clientId,
  onClose,
  onSaved,
}: {
  report: AdminReportRow | null;
  clientId: string;
  onClose: () => void;
  onSaved: (saved: AdminReportRow) => void;
}) {
  const isNew = report === null;

  const [title, setTitle] = useState(report?.title ?? "");
  const [period, setPeriod] = useState(report?.period ?? "");
  const [status, setStatus] = useState<ReportStatus>(report?.status ?? "draft");
  const [summary, setSummary] = useState(report?.summary ?? "");
  const [description, setDescription] = useState(report?.description ?? "");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = useCallback(async () => {
    if (!title.trim()) { setValidationError("Título é obrigatório."); return; }
    if (!period.trim()) { setValidationError("Período é obrigatório."); return; }
    if (isNew && !selectedFile) { setValidationError("Arquivo é obrigatório."); return; }
    setValidationError(null);
    setSaveState("saving");

    try {
      if (isNew) {
        const fd = new FormData();
        fd.append("clientId", clientId);
        fd.append("title", title.trim());
        fd.append("period", period.trim());
        fd.append("status", status);
        if (summary.trim()) fd.append("summary", summary.trim());
        if (description.trim()) fd.append("description", description.trim());
        fd.append("file", selectedFile!);

        const res = await fetch("/api/admin/reports", { method: "POST", body: fd });
        const json: ReportCreateResponse = await res.json();
        if (!json.success || !json.report) {
          const base = json.error ?? "Erro ao criar relatório.";
          setValidationError(json.detail ? `${base} — ${json.detail}` : base);
          setSaveState("idle");
          return;
        }
        setSaveState("saved");
        const saved = json.report;
        setTimeout(() => onSaved(saved), 600);
      } else {
        const body: Record<string, unknown> = {
          title: title.trim(),
          period: period.trim(),
          status,
          summary: summary.trim() || null,
          description: description.trim() || null,
        };
        const res = await fetch(`/api/admin/reports/${report!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json: ReportPatchResponse = await res.json();
        if (!json.success || !json.report) {
          const base = json.error ?? "Erro ao atualizar relatório.";
          setValidationError(json.detail ? `${base} — ${json.detail}` : base);
          setSaveState("idle");
          return;
        }
        setSaveState("saved");
        const saved = json.report;
        setTimeout(() => onSaved(saved), 600);
      }
    } catch {
      setValidationError("Não foi possível conectar ao servidor.");
      setSaveState("idle");
    }
  }, [isNew, title, period, status, summary, description, selectedFile, clientId, report, onSaved]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-end"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative w-full max-w-md h-full bg-[#0d1117] border-l border-white/[0.08] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-white/[0.07] bg-[#0d1117]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center">
              <FileText size={11} className="text-white/50" />
            </div>
            <p className="text-[11px] font-light text-white/80">
              {isNew ? "Novo Relatório" : "Editar Relatório"}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors">
            <X size={13} className="text-white/40 hover:text-white/70" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 px-5 py-4 space-y-4">
          {validationError && (
            <p className="text-[10px] font-light text-red-400/80">{validationError}</p>
          )}

          {/* Título */}
          <div>
            <label className="text-[9px] font-light text-white/50 block mb-1">Título *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Relatório Mensal — Marketing Digital"
              className="w-full bg-white/[0.06] border border-white/[0.10] rounded-lg px-3 py-2 text-[11px] font-light text-white/85 placeholder-white/25 focus:outline-none focus:border-white/25 transition-colors"
            />
          </div>

          {/* Período */}
          <div>
            <label className="text-[9px] font-light text-white/50 block mb-1">
              Período / Competência *
            </label>
            <input
              type="text"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              placeholder="Ex: Maio/2026 ou 01/05 a 31/05/2026"
              className="w-full bg-white/[0.06] border border-white/[0.10] rounded-lg px-3 py-2 text-[11px] font-light text-white/85 placeholder-white/25 focus:outline-none focus:border-white/25 transition-colors"
            />
          </div>

          {/* Status */}
          <div>
            <label className="text-[9px] font-light text-white/50 block mb-1.5">Status</label>
            <div className="flex gap-2 flex-wrap">
              {(["draft", "published", "archived"] as const).map((s) => {
                const Icon = STATUS_ICONS[s];
                return (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    className={`inline-flex items-center gap-1.5 text-[9px] font-light px-3 py-1.5 rounded-full border transition-all ${
                      status === s
                        ? DRAWER_STATUS_STYLES[s]
                        : "border-white/[0.10] text-white/40 hover:border-white/20 hover:text-white/60"
                    }`}
                  >
                    <Icon size={9} />
                    {STATUS_LABELS[s]}
                  </button>
                );
              })}
            </div>
            {status === "draft" && (
              <p className="text-[9px] font-light text-amber-400/60 mt-1.5">
                Rascunho não é visível para o cliente.
              </p>
            )}
            {status === "published" && (
              <p className="text-[9px] font-light text-emerald-400/60 mt-1.5">
                Publicado — visível no portal do cliente.
              </p>
            )}
          </div>

          {/* Arquivo — somente na criação */}
          {isNew && (
            <div>
              <label className="text-[9px] font-light text-white/50 block mb-1">
                Arquivo *{" "}
                <span className="text-white/25">(PDF, PNG ou JPEG · máx 10 MB)</span>
              </label>
              <div
                className="relative flex items-center gap-2 border border-dashed border-white/[0.15] rounded-lg px-3 py-2.5 cursor-pointer hover:border-white/30 transition-colors"
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
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setSelectedFile(f);
                    if (f) setValidationError(null);
                  }}
                />
              </div>
              {selectedFile && (
                <p className="text-[9px] font-light text-white/40 mt-1">
                  {selectedFile.name} · {formatFileSize(selectedFile.size)}
                </p>
              )}
            </div>
          )}

          {/* Arquivo existente — na edição, info only */}
          {!isNew && report?.fileName && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-white/[0.08] bg-white/[0.03]">
              <FileText size={11} className="text-white/35 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-light text-white/60 truncate">{report.fileName}</p>
                {report.fileSize && (
                  <p className="text-[9px] font-light text-white/35">{formatFileSize(report.fileSize)}</p>
                )}
              </div>
              <a
                href={`/api/admin/reports/${report.id}/download`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto text-[9px] font-light text-white/40 hover:text-white/70 transition-colors flex items-center gap-1"
              >
                <Download size={9} />
                Baixar
              </a>
            </div>
          )}

          {/* Resumo */}
          <div>
            <label className="text-[9px] font-light text-white/50 block mb-1">
              Resumo / Observações{" "}
              <span className="text-white/25">(opcional)</span>
            </label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Descrição do relatório, principais métricas, destaques do período…"
              rows={4}
              className="w-full bg-white/[0.06] border border-white/[0.10] rounded-lg px-3 py-2 text-[11px] font-light text-white/85 placeholder-white/25 focus:outline-none focus:border-white/25 transition-colors resize-none"
            />
          </div>

          {/* Descrição interna */}
          <div>
            <label className="text-[9px] font-light text-white/50 block mb-1">
              Descrição interna{" "}
              <span className="text-white/25">(opcional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Anotações internas sobre este relatório…"
              rows={3}
              className="w-full bg-white/[0.06] border border-white/[0.10] rounded-lg px-3 py-2 text-[11px] font-light text-white/85 placeholder-white/25 focus:outline-none focus:border-white/25 transition-colors resize-none"
            />
          </div>

          {/* Save */}
          <div className="flex justify-end pt-1">
            <button
              onClick={handleSave}
              disabled={saveState === "saving"}
              className={`text-[9px] font-light px-4 py-2 rounded-full border transition-all disabled:cursor-not-allowed ${
                saveState === "saved"
                  ? "border-emerald-400/40 text-emerald-400/80 bg-emerald-400/10"
                  : saveState === "error"
                    ? "border-red-400/40 text-red-400/70 bg-red-400/10"
                    : "border-white/20 text-white/70 hover:border-white/35 hover:text-white/90 disabled:opacity-40"
              }`}
            >
              {saveState === "saving" ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 size={9} className="animate-spin" />
                  {isNew ? "Enviando arquivo…" : "Salvando…"}
                </span>
              ) : saveState === "saved" ? (
                "Salvo!"
              ) : saveState === "error" ? (
                "Erro — tentar novamente"
              ) : isNew ? (
                "Criar relatório"
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

export function ReportsAdminPanel({ allClients }: { allClients: AdminClientRow[] }) {
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [reports, setReports] = useState<AdminReportRow[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [editingReport, setEditingReport] = useState<AdminReportRow | "new" | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ReportStatus>("all");
  const [deletingReport, setDeletingReport] = useState<AdminReportRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleClientSelect = useCallback((clientId: string) => {
    setSelectedClientId(clientId);
    setSearchQuery("");
    setStatusFilter("all");
    setReports([]);
    setFetchError(null);
    if (!clientId) return;
    setLoadingReports(true);
    fetch(`/api/admin/reports?clientId=${encodeURIComponent(clientId)}`)
      .then((r) => r.json())
      .then((json: ReportListResponse) => {
        if (!json.success) {
          setFetchError(json.error ?? "Erro ao carregar relatórios.");
          setReports([]);
        } else {
          setReports(json.reports ?? []);
        }
      })
      .catch(() => setFetchError("Não foi possível conectar ao servidor."))
      .finally(() => setLoadingReports(false));
  }, []);

  const handleSaved = useCallback((saved: AdminReportRow) => {
    setReports((prev) => {
      const idx = prev.findIndex((r) => r.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    setEditingReport(null);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deletingReport) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/admin/reports/${deletingReport.id}`, { method: "DELETE" });
      const json: ReportDeleteResponse = await res.json();
      if (!json.success) {
        setDeleteError(json.error ?? "Erro ao excluir relatório.");
        setIsDeleting(false);
        return;
      }
      setReports((prev) => prev.filter((r) => r.id !== deletingReport.id));
      setDeletingReport(null);
    } catch {
      setDeleteError("Não foi possível conectar ao servidor.");
    } finally {
      setIsDeleting(false);
    }
  }, [deletingReport]);

  const filtered = reports.filter((rep) => {
    const q = searchQuery.toLowerCase();
    const matchQ =
      !q ||
      rep.title.toLowerCase().includes(q) ||
      rep.period.toLowerCase().includes(q);
    const matchS = statusFilter === "all" || rep.status === statusFilter;
    return matchQ && matchS;
  });

  const selectedClient = allClients.find((c) => c.id === selectedClientId);

  const counts = {
    published: reports.filter((r) => r.status === "published").length,
    draft:     reports.filter((r) => r.status === "draft").length,
    archived:  reports.filter((r) => r.status === "archived").length,
  };

  return (
    <div className="space-y-5">
      {/* Client selector + Novo Relatório */}
      <div className="flex items-center gap-3 flex-wrap">
        <ClientSelector
          allClients={allClients}
          selectedClientId={selectedClientId}
          onSelect={handleClientSelect}
        />

        {selectedClientId && (
          <button
            onClick={() => setEditingReport("new")}
            className="flex items-center gap-1.5 text-[9px] font-light px-3 py-2 rounded-full border border-vitti-medium/30 text-vitti-light/60 hover:border-vitti-medium/60 hover:text-vitti-light/90 transition-all"
          >
            <Plus size={10} />
            Novo Relatório
          </button>
        )}

        {selectedClientId && (
          <Link
            href={`/relatorios?clientId=${encodeURIComponent(selectedClientId)}`}
            target="_blank"
            className="flex items-center gap-1.5 text-[9px] font-light px-3 py-2 rounded-full border border-black/[0.08] text-[#5F6368]/60 hover:text-[#111111]/75 hover:border-black/[0.15] transition-all"
          >
            <ExternalLink size={10} />
            Ver como cliente
          </Link>
        )}
      </div>

      {/* Empty — no client selected */}
      {!selectedClientId && (
        <div className="flex flex-col items-center gap-2 py-16">
          <FileText size={24} className="text-slate-400" />
          <p className="text-[11px] font-light text-slate-600">
            Selecione um cliente para visualizar e gerenciar os relatórios.
          </p>
        </div>
      )}

      {/* Loading */}
      {selectedClientId && loadingReports && (
        <div className="flex items-center gap-2 py-10 justify-center text-[#5F6368]/60">
          <Loader2 size={14} className="animate-spin" />
          <span className="text-[11px] font-light">Carregando…</span>
        </div>
      )}

      {/* Fetch error */}
      {selectedClientId && !loadingReports && fetchError && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-red-400/20 bg-red-400/[0.03]">
          <AlertCircle size={13} className="text-red-400/60 shrink-0" />
          <p className="text-[11px] font-light text-red-400/70 flex-1">{fetchError}</p>
          <button
            onClick={() => handleClientSelect(selectedClientId)}
            className="flex items-center gap-1 text-[9px] font-light text-[#5F6368]/60 hover:text-[#111111]/75 transition-colors"
          >
            <RefreshCw size={9} />
            Tentar novamente
          </button>
        </div>
      )}

      {/* Report list */}
      {selectedClientId && !loadingReports && !fetchError && (
        <div className="space-y-4">
          {/* Stats */}
          {reports.length > 0 && (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[9px] font-light text-emerald-600/70">
                {counts.published} publicado{counts.published !== 1 ? "s" : ""}
              </span>
              <span className="text-[#5F6368]/30 text-[9px]">·</span>
              <span className="text-[9px] font-light text-amber-600/60">
                {counts.draft} rascunho{counts.draft !== 1 ? "s" : ""}
              </span>
              {counts.archived > 0 && (
                <>
                  <span className="text-[#5F6368]/30 text-[9px]">·</span>
                  <span className="text-[9px] font-light text-[#5F6368]/60">
                    {counts.archived} arquivado{counts.archived !== 1 ? "s" : ""}
                  </span>
                </>
              )}
            </div>
          )}

          {/* Search + status filter */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={11} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5F6368]/50" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por título ou período…"
                className="w-full bg-white border border-black/[0.08] rounded-xl pl-8 pr-3 py-2.5 text-[11px] font-light text-[#111111]/80 placeholder-[#5F6368]/45 focus:outline-none focus:border-vitti-medium/30 transition-colors shadow-[0_1px_3px_rgb(0,0,0,0.04)]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X size={10} className="text-[#5F6368]/60 hover:text-[#111111]/75" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1">
              {(["all", "published", "draft", "archived"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`text-[9px] font-light px-2.5 py-1.5 rounded-full border transition-all ${
                    statusFilter === s
                      ? "border-vitti-medium/50 text-vitti-medium/80 bg-vitti-medium/10"
                      : "border-black/[0.08] text-[#5F6368]/60 hover:border-black/[0.15] hover:text-[#111111]/70"
                  }`}
                >
                  {s === "all" ? "Todos" : STATUS_LABELS[s as ReportStatus]}
                </button>
              ))}
            </div>

            <span className="text-[9px] font-light text-[#5F6368]/55 ml-auto">
              {filtered.length} de {reports.length}
            </span>
          </div>

          {/* Empty — no reports */}
          {reports.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-12">
              <FileText size={22} className="text-[#5F6368]/25" />
              <p className="text-[11px] font-light text-[#5F6368]/55">
                Nenhum relatório cadastrado para{" "}
                {selectedClient?.name ?? "este cliente"}.
              </p>
              <button
                onClick={() => setEditingReport("new")}
                className="mt-1 text-[9px] font-light px-3 py-1.5 rounded-full border border-vitti-medium/25 text-vitti-medium/60 hover:border-vitti-medium/50 hover:text-vitti-medium/80 transition-all"
              >
                + Criar primeiro relatório
              </button>
            </div>
          )}

          {/* Empty — filtered */}
          {reports.length > 0 && filtered.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10">
              <p className="text-[11px] font-light text-[#5F6368]/55">
                Nenhum relatório encontrado com esses filtros.
              </p>
            </div>
          )}

          {/* Report rows */}
          {filtered.length > 0 && (
            <div className="space-y-2">
              {filtered.map((rep) => (
                <ReportRow
                  key={rep.id}
                  report={rep}
                  onEdit={() => setEditingReport(rep)}
                  onDelete={() => {
                    setDeleteError(null);
                    setDeletingReport(rep);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Info note */}
      <div className="rounded-xl border border-black/[0.10] bg-black/[0.02] px-4 py-3">
        <p className="text-[9px] font-light text-slate-600 leading-relaxed">
          <span className="text-slate-700 font-normal">Relatórios por upload</span> — faça upload do arquivo
          (PDF, PNG ou JPEG). Apenas relatórios com status{" "}
          <span className="text-emerald-700/80">Publicado</span> são visíveis no portal do
          cliente. O arquivo fica em storage privado e o download é gerado com link temporário.
        </p>
      </div>

      {/* Create / Edit modal */}
      {editingReport !== null && (
        <ReportModal
          report={editingReport === "new" ? null : editingReport}
          clientId={selectedClientId}
          onClose={() => setEditingReport(null)}
          onSaved={handleSaved}
        />
      )}

      {/* Delete confirmation */}
      {deletingReport !== null && (
        <DeleteConfirmModal
          report={deletingReport}
          onCancel={() => {
            if (!isDeleting) setDeletingReport(null);
          }}
          onConfirm={handleDeleteConfirm}
          isDeleting={isDeleting}
          deleteError={deleteError}
        />
      )}
    </div>
  );
}

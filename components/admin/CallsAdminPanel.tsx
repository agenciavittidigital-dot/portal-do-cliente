"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Search,
  X,
  Plus,
  Loader2,
  Pencil,
  Eye,
  EyeOff,
  Archive,
  AlertCircle,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import type { AdminCallRow, CallType, CallStatus } from "@/lib/data/calls-admin";
import type { AdminClientRow } from "@/lib/data/clients-admin";
import type { CallListResponse, CallCreateResponse } from "@/app/api/admin/calls/route";
import type { CallPatchResponse } from "@/app/api/admin/calls/[id]/route";

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<CallStatus, string> = {
  draft:     "Rascunho",
  published: "Publicado",
  archived:  "Arquivado",
};

const STATUS_STYLES: Record<CallStatus, string> = {
  published: "border-emerald-400/30 text-emerald-400/70 bg-emerald-400/5",
  draft:     "border-amber-400/30 text-amber-400/70 bg-amber-400/5",
  archived:  "border-black/[0.08] text-[#5F6368]/55 bg-black/[0.02]",
};

const STATUS_ICONS: Record<CallStatus, React.ElementType> = {
  published: Eye,
  draft:     EyeOff,
  archived:  Archive,
};

const TYPE_LABELS: Record<CallType, string> = {
  performance:        "Performance",
  alignment:          "Alinhamento",
  planning:           "Planejamento",
  onboarding:         "Onboarding",
  report_presentation:"Apresentação de Relatório",
  other:              "Outro",
};

const CALL_TYPES: CallType[] = [
  "performance",
  "alignment",
  "planning",
  "onboarding",
  "report_presentation",
  "other",
];

const CALL_STATUSES: CallStatus[] = ["draft", "published", "archived"];

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  if (!iso) return "—";
  const parts = iso.split("T")[0].split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return iso;
}

function formatDuration(minutes: number | null): string {
  if (!minutes) return "—";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

// ── BackToAdmin ────────────────────────────────────────────────────────────────

export function BackToAdmin() {
  return (
    <Link
      href="/admin"
      className="inline-flex items-center gap-1.5 text-[10px] font-light text-[#5F6368]/60 hover:text-[#111111]/75 transition-colors"
    >
      <ArrowLeft size={11} />
      Admin
    </Link>
  );
}

// ── StatusBadge ────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: CallStatus }) {
  const Icon = STATUS_ICONS[status];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-light ${STATUS_STYLES[status]}`}
    >
      <Icon size={9} />
      {STATUS_LABELS[status]}
    </span>
  );
}

// ── Modal overlay ──────────────────────────────────────────────────────────────

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#0d1117] border border-black/[0.08] rounded-xl shadow-2xl p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

// ── CreateModal ────────────────────────────────────────────────────────────────

function CreateModal({
  clientId,
  onClose,
  onCreated,
}: {
  clientId: string;
  onClose: () => void;
  onCreated: (call: AdminCallRow) => void;
}) {
  const [title, setTitle] = useState("");
  const [callType, setCallType] = useState<CallType>("alignment");
  const [callDate, setCallDate] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [recordingUrl, setRecordingUrl] = useState("");
  const [description, setDescription] = useState("");
  const [summary, setSummary] = useState("");
  const [status, setStatus] = useState<CallStatus>("draft");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) { setError("Título é obrigatório."); return; }
    if (!callDate.trim()) { setError("Data da call é obrigatória."); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          title: title.trim(),
          callType,
          callDate,
          durationMinutes: durationMinutes ? Number(durationMinutes) : null,
          recordingUrl: recordingUrl.trim() || null,
          description: description.trim() || null,
          summary: summary.trim() || null,
          status,
        }),
      });
      const json = (await res.json()) as CallCreateResponse;
      if (!json.success || !json.call) {
        setError(json.error ?? "Erro ao criar call.");
        return;
      }
      onCreated(json.call);
    } catch {
      setError("Erro de rede.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-light text-[#111111]/90 tracking-wide">Nova Call</h3>
        <button onClick={onClose} className="text-[#5F6368]/55 hover:text-[#111111]/75 transition-colors">
          <X size={14} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-[10px] text-[#5F6368]/60 font-light mb-1.5">Título *</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Call de Performance — Maio 2025"
            className="w-full bg-black/[0.03] border border-black/[0.08] rounded-lg px-3 py-2 text-sm text-[#111111]/90 placeholder:text-[#5F6368]/35 font-light focus:outline-none focus:border-white/20"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] text-[#5F6368]/60 font-light mb-1.5">Tipo *</label>
            <select
              value={callType}
              onChange={(e) => setCallType(e.target.value as CallType)}
              className="w-full bg-black/[0.03] border border-black/[0.08] rounded-lg px-3 py-2 text-sm text-[#111111]/90 font-light focus:outline-none focus:border-white/20"
            >
              {CALL_TYPES.map((t) => (
                <option key={t} value={t} className="bg-[#0d1117]">
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-[#5F6368]/60 font-light mb-1.5">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as CallStatus)}
              className="w-full bg-black/[0.03] border border-black/[0.08] rounded-lg px-3 py-2 text-sm text-[#111111]/90 font-light focus:outline-none focus:border-white/20"
            >
              {CALL_STATUSES.map((s) => (
                <option key={s} value={s} className="bg-[#0d1117]">
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] text-[#5F6368]/60 font-light mb-1.5">Data da call *</label>
            <input
              type="date"
              value={callDate}
              onChange={(e) => setCallDate(e.target.value)}
              className="w-full bg-black/[0.03] border border-black/[0.08] rounded-lg px-3 py-2 text-sm text-[#111111]/90 font-light focus:outline-none focus:border-white/20"
            />
          </div>
          <div>
            <label className="block text-[10px] text-[#5F6368]/60 font-light mb-1.5">Duração (min)</label>
            <input
              type="number"
              min="1"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              placeholder="Ex: 60"
              className="w-full bg-black/[0.03] border border-black/[0.08] rounded-lg px-3 py-2 text-sm text-[#111111]/90 placeholder:text-[#5F6368]/35 font-light focus:outline-none focus:border-white/20"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] text-[#5F6368]/60 font-light mb-1.5">Link da gravação</label>
          <input
            type="url"
            value={recordingUrl}
            onChange={(e) => setRecordingUrl(e.target.value)}
            placeholder="https://..."
            className="w-full bg-black/[0.03] border border-black/[0.08] rounded-lg px-3 py-2 text-sm text-[#111111]/90 placeholder:text-[#5F6368]/35 font-light focus:outline-none focus:border-white/20"
          />
        </div>

        <div>
          <label className="block text-[10px] text-[#5F6368]/60 font-light mb-1.5">Descrição</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Breve descrição da call..."
            className="w-full bg-black/[0.03] border border-black/[0.08] rounded-lg px-3 py-2 text-sm text-[#111111]/90 placeholder:text-[#5F6368]/35 font-light focus:outline-none focus:border-white/20 resize-none"
          />
        </div>

        <div>
          <label className="block text-[10px] text-[#5F6368]/60 font-light mb-1.5">Resumo / Notas</label>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
            placeholder="Pontos discutidos, decisões, próximos passos..."
            className="w-full bg-black/[0.03] border border-black/[0.08] rounded-lg px-3 py-2 text-sm text-[#111111]/90 placeholder:text-[#5F6368]/35 font-light focus:outline-none focus:border-white/20 resize-none"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-[11px] text-red-400/80 bg-red-400/5 border border-red-400/20 rounded-lg px-3 py-2">
            <AlertCircle size={12} className="shrink-0" />
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-light text-[#5F6368]/70 hover:text-[#111111]/85 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-xs font-light bg-black/[0.06] hover:bg-white/[0.09] border border-black/[0.08] rounded-lg text-[#111111]/80 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
            Criar call
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── EditModal ──────────────────────────────────────────────────────────────────

function EditModal({
  call,
  onClose,
  onUpdated,
}: {
  call: AdminCallRow;
  onClose: () => void;
  onUpdated: (call: AdminCallRow) => void;
}) {
  const [title, setTitle] = useState(call.title);
  const [callType, setCallType] = useState<CallType>(call.callType);
  const [callDate, setCallDate] = useState(call.callDate.split("T")[0]);
  const [durationMinutes, setDurationMinutes] = useState(
    call.durationMinutes != null ? String(call.durationMinutes) : ""
  );
  const [recordingUrl, setRecordingUrl] = useState(call.recordingUrl ?? "");
  const [description, setDescription] = useState(call.description ?? "");
  const [summary, setSummary] = useState(call.summary ?? "");
  const [status, setStatus] = useState<CallStatus>(call.status);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) { setError("Título é obrigatório."); return; }

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/calls/${call.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          callType,
          callDate,
          durationMinutes: durationMinutes ? Number(durationMinutes) : null,
          recordingUrl: recordingUrl.trim() || null,
          description: description.trim() || null,
          summary: summary.trim() || null,
          status,
        }),
      });
      const json = (await res.json()) as CallPatchResponse;
      if (!json.success || !json.call) {
        setError(json.error ?? "Erro ao atualizar call.");
        return;
      }
      onUpdated(json.call);
    } catch {
      setError("Erro de rede.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-light text-[#111111]/90 tracking-wide">Editar Call</h3>
        <button onClick={onClose} className="text-[#5F6368]/55 hover:text-[#111111]/75 transition-colors">
          <X size={14} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-[10px] text-[#5F6368]/60 font-light mb-1.5">Título *</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-black/[0.03] border border-black/[0.08] rounded-lg px-3 py-2 text-sm text-[#111111]/90 placeholder:text-[#5F6368]/35 font-light focus:outline-none focus:border-white/20"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] text-[#5F6368]/60 font-light mb-1.5">Tipo *</label>
            <select
              value={callType}
              onChange={(e) => setCallType(e.target.value as CallType)}
              className="w-full bg-black/[0.03] border border-black/[0.08] rounded-lg px-3 py-2 text-sm text-[#111111]/90 font-light focus:outline-none focus:border-white/20"
            >
              {CALL_TYPES.map((t) => (
                <option key={t} value={t} className="bg-[#0d1117]">
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-[#5F6368]/60 font-light mb-1.5">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as CallStatus)}
              className="w-full bg-black/[0.03] border border-black/[0.08] rounded-lg px-3 py-2 text-sm text-[#111111]/90 font-light focus:outline-none focus:border-white/20"
            >
              {CALL_STATUSES.map((s) => (
                <option key={s} value={s} className="bg-[#0d1117]">
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] text-[#5F6368]/60 font-light mb-1.5">Data da call *</label>
            <input
              type="date"
              value={callDate}
              onChange={(e) => setCallDate(e.target.value)}
              className="w-full bg-black/[0.03] border border-black/[0.08] rounded-lg px-3 py-2 text-sm text-[#111111]/90 font-light focus:outline-none focus:border-white/20"
            />
          </div>
          <div>
            <label className="block text-[10px] text-[#5F6368]/60 font-light mb-1.5">Duração (min)</label>
            <input
              type="number"
              min="1"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              placeholder="Ex: 60"
              className="w-full bg-black/[0.03] border border-black/[0.08] rounded-lg px-3 py-2 text-sm text-[#111111]/90 placeholder:text-[#5F6368]/35 font-light focus:outline-none focus:border-white/20"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] text-[#5F6368]/60 font-light mb-1.5">Link da gravação</label>
          <input
            type="url"
            value={recordingUrl}
            onChange={(e) => setRecordingUrl(e.target.value)}
            placeholder="https://..."
            className="w-full bg-black/[0.03] border border-black/[0.08] rounded-lg px-3 py-2 text-sm text-[#111111]/90 placeholder:text-[#5F6368]/35 font-light focus:outline-none focus:border-white/20"
          />
          {call.recordingUrl && (
            <a
              href={call.recordingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-1 text-[10px] text-vitti-light/50 hover:text-vitti-light/80 transition-colors"
            >
              <ExternalLink size={9} />
              Abrir gravação atual
            </a>
          )}
        </div>

        <div>
          <label className="block text-[10px] text-[#5F6368]/60 font-light mb-1.5">Descrição</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Breve descrição da call..."
            className="w-full bg-black/[0.03] border border-black/[0.08] rounded-lg px-3 py-2 text-sm text-[#111111]/90 placeholder:text-[#5F6368]/35 font-light focus:outline-none focus:border-white/20 resize-none"
          />
        </div>

        <div>
          <label className="block text-[10px] text-[#5F6368]/60 font-light mb-1.5">Resumo / Notas</label>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
            placeholder="Pontos discutidos, decisões, próximos passos..."
            className="w-full bg-black/[0.03] border border-black/[0.08] rounded-lg px-3 py-2 text-sm text-[#111111]/90 placeholder:text-[#5F6368]/35 font-light focus:outline-none focus:border-white/20 resize-none"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-[11px] text-red-400/80 bg-red-400/5 border border-red-400/20 rounded-lg px-3 py-2">
            <AlertCircle size={12} className="shrink-0" />
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-light text-[#5F6368]/70 hover:text-[#111111]/85 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-xs font-light bg-black/[0.06] hover:bg-white/[0.09] border border-black/[0.08] rounded-lg text-[#111111]/80 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Pencil size={12} />}
            Salvar alterações
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Main Panel ─────────────────────────────────────────────────────────────────

export function CallsAdminPanel({ allClients }: { allClients: AdminClientRow[] }) {
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [calls, setCalls] = useState<AdminCallRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editCall, setEditCall] = useState<AdminCallRow | null>(null);

  const loadCalls = useCallback(async (clientId: string) => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/admin/calls?clientId=${encodeURIComponent(clientId)}`);
      const json = (await res.json()) as CallListResponse;
      if (!json.success) {
        setFetchError(json.error ?? "Erro ao carregar calls.");
        setCalls([]);
      } else {
        setCalls(json.calls ?? []);
      }
    } catch {
      setFetchError("Erro de rede.");
    } finally {
      setLoading(false);
    }
  }, []);

  function handleClientChange(clientId: string) {
    setSelectedClientId(clientId);
    setCalls([]);
    setSearch("");
    setFetchError(null);
    if (clientId) loadCalls(clientId);
  }

  const filtered = calls.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.title.toLowerCase().includes(q) ||
      TYPE_LABELS[c.callType].toLowerCase().includes(q) ||
      STATUS_LABELS[c.status].toLowerCase().includes(q)
    );
  });

  const counts = {
    published: calls.filter((c) => c.status === "published").length,
    draft: calls.filter((c) => c.status === "draft").length,
    archived: calls.filter((c) => c.status === "archived").length,
  };

  return (
    <>
      {showCreate && selectedClientId && (
        <CreateModal
          clientId={selectedClientId}
          onClose={() => setShowCreate(false)}
          onCreated={(call) => {
            setCalls((prev) => [call, ...prev]);
            setShowCreate(false);
          }}
        />
      )}

      {editCall && (
        <EditModal
          call={editCall}
          onClose={() => setEditCall(null)}
          onUpdated={(updated) => {
            setCalls((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
            setEditCall(null);
          }}
        />
      )}

      <div className="space-y-5">
        {/* Client selector */}
        <div className="flex items-center gap-3">
          <select
            value={selectedClientId}
            onChange={(e) => handleClientChange(e.target.value)}
            className="bg-black/[0.03] border border-black/[0.08] rounded-lg px-3 py-2 text-sm text-[#111111]/80 font-light focus:outline-none focus:border-white/20 min-w-[220px]"
          >
            <option value="" className="bg-[#0d1117]">Selecionar cliente...</option>
            {allClients.map((c) => (
              <option key={c.id} value={c.id} className="bg-[#0d1117]">
                {c.name}
              </option>
            ))}
          </select>

          {selectedClientId && (
            <button
              onClick={() => loadCalls(selectedClientId)}
              className="text-[#5F6368]/55 hover:text-[#111111]/75 transition-colors"
              title="Recarregar"
            >
              <RefreshCw size={13} />
            </button>
          )}

          {selectedClientId && (
            <Link
              href={`/calls?clientId=${encodeURIComponent(selectedClientId)}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 text-[9px] font-light px-3 py-2 rounded-full border border-black/[0.08] text-[#5F6368]/60 hover:text-[#111111]/75 hover:border-black/[0.15] transition-all"
            >
              <ExternalLink size={10} />
              Ver como cliente
            </Link>
          )}

          {selectedClientId && (
            <button
              onClick={() => setShowCreate(true)}
              className="ml-auto inline-flex items-center gap-2 px-3 py-2 text-xs font-light bg-black/[0.04] hover:bg-white/[0.07] border border-black/[0.08] rounded-lg text-[#111111]/70 transition-colors"
            >
              <Plus size={12} />
              Nova call
            </button>
          )}
        </div>

        {/* Stats */}
        {selectedClientId && calls.length > 0 && (
          <div className="flex gap-4">
            {(["published", "draft", "archived"] as CallStatus[]).map((s) => (
              <div key={s} className="flex items-center gap-1.5">
                <span className={`text-xs font-light px-2 py-0.5 rounded border ${STATUS_STYLES[s]}`}>
                  {counts[s]}
                </span>
                <span className="text-[10px] text-[#5F6368]/55 font-light">{STATUS_LABELS[s]}</span>
              </div>
            ))}
          </div>
        )}

        {/* Search */}
        {selectedClientId && calls.length > 0 && (
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5F6368]/50" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por título, tipo ou status..."
              className="w-full bg-black/[0.03] border border-black/[0.08] rounded-lg pl-9 pr-3 py-2 text-sm text-[#111111]/80 placeholder:text-[#5F6368]/35 font-light focus:outline-none focus:border-white/20"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5F6368]/50 hover:text-[#111111]/70"
              >
                <X size={12} />
              </button>
            )}
          </div>
        )}

        {/* State: loading */}
        {loading && (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={18} className="animate-spin text-[#5F6368]/50" />
          </div>
        )}

        {/* State: error */}
        {!loading && fetchError && (
          <div className="flex items-center gap-2 text-[11px] text-red-400/70 bg-red-400/5 border border-red-400/15 rounded-lg px-4 py-3">
            <AlertCircle size={13} className="shrink-0" />
            {fetchError}
          </div>
        )}

        {/* State: no client */}
        {!selectedClientId && !loading && (
          <div className="text-[11px] text-[#5F6368]/50 font-light py-6 text-center">
            Selecione um cliente para ver as calls.
          </div>
        )}

        {/* State: empty */}
        {selectedClientId && !loading && !fetchError && calls.length === 0 && (
          <div className="text-[11px] text-[#5F6368]/50 font-light py-6 text-center">
            Nenhuma call encontrada para este cliente.
          </div>
        )}

        {/* Table */}
        {!loading && filtered.length > 0 && (
          <div className="border border-black/[0.07] rounded-xl overflow-hidden">
            <table className="w-full text-xs font-light">
              <thead>
                <tr className="border-b border-black/[0.06] bg-black/[0.02]">
                  <th className="text-left px-4 py-2.5 text-[10px] text-[#5F6368]/55 font-light">Título</th>
                  <th className="text-left px-4 py-2.5 text-[10px] text-[#5F6368]/55 font-light">Tipo</th>
                  <th className="text-left px-4 py-2.5 text-[10px] text-[#5F6368]/55 font-light">Data</th>
                  <th className="text-left px-4 py-2.5 text-[10px] text-[#5F6368]/55 font-light">Duração</th>
                  <th className="text-left px-4 py-2.5 text-[10px] text-[#5F6368]/55 font-light">Status</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((call, idx) => (
                  <tr
                    key={call.id}
                    className={`border-b border-black/[0.04] hover:bg-black/[0.02] transition-colors ${
                      idx === filtered.length - 1 ? "border-b-0" : ""
                    }`}
                  >
                    <td className="px-4 py-3 text-[#111111]/80 max-w-[220px]">
                      <div className="truncate">{call.title}</div>
                      {call.recordingUrl && (
                        <a
                          href={call.recordingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 mt-0.5 text-[9px] text-vitti-light/40 hover:text-vitti-light/70 transition-colors"
                        >
                          <ExternalLink size={8} />
                          Gravação
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[#5F6368]/70 whitespace-nowrap">
                      {TYPE_LABELS[call.callType]}
                    </td>
                    <td className="px-4 py-3 text-[#5F6368]/70 whitespace-nowrap">
                      {formatDate(call.callDate)}
                    </td>
                    <td className="px-4 py-3 text-[#5F6368]/70 whitespace-nowrap">
                      {formatDuration(call.durationMinutes)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={call.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setEditCall(call)}
                        className="text-[#5F6368]/50 hover:text-[#111111]/75 transition-colors"
                        title="Editar"
                      >
                        <Pencil size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

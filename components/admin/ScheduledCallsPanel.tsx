"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2,
  AlertCircle,
  RefreshCw,
  Plus,
  Pencil,
  X,
  ExternalLink,
  CheckCircle2,
  XCircle,
  CalendarClock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  AdminScheduledCallRow,
  ScheduledCallStatus,
  ScheduledCallType,
} from "@/lib/data/scheduled-calls-admin";
import type { AdminClientRow } from "@/lib/data/clients-admin";

// ── Local response types ───────────────────────────────────────────────────────

interface ScheduledCallListResponse {
  success: boolean;
  calls?: AdminScheduledCallRow[];
  error?: string;
}

interface ScheduledCallMutationResponse {
  success: boolean;
  call?: AdminScheduledCallRow;
  error?: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<ScheduledCallStatus, string> = {
  upcoming:  "Próxima",
  done:      "Concluída",
  cancelled: "Cancelada",
};

const STATUS_STYLES: Record<ScheduledCallStatus, string> = {
  upcoming:  "border-blue-400/40 text-blue-700/80 bg-blue-50",
  done:      "border-emerald-400/40 text-emerald-700/80 bg-emerald-50",
  cancelled: "border-black/[0.08] text-[#5F6368]/55 bg-black/[0.02]",
};

const CALL_TYPES: ScheduledCallType[] = [
  "performance",
  "alignment",
  "planning",
  "onboarding",
  "report_presentation",
  "other",
];

const TYPE_LABELS: Record<ScheduledCallType, string> = {
  performance:          "Performance",
  alignment:            "Alinhamento",
  planning:             "Planejamento",
  onboarding:           "Onboarding",
  report_presentation:  "Apresentação de Relatório",
  other:                "Outro",
};

const SCHEDULED_STATUSES: ScheduledCallStatus[] = ["upcoming", "done", "cancelled"];

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatScheduledAt(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function extractLocalDateTime(iso: string): { date: string; time: string } {
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = fmt.formatToParts(d);
    const h = (parts.find((p) => p.type === "hour")?.value ?? "09").padStart(2, "0");
    const m = (parts.find((p) => p.type === "minute")?.value ?? "00").padStart(2, "0");
    return { date, time: `${h}:${m}` };
  } catch {
    return { date: "", time: "09:00" };
  }
}

// ── Toast ──────────────────────────────────────────────────────────────────────

function Toast({
  message,
  type,
  onClose,
}: {
  message: string;
  type: "success" | "error";
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      role="alert"
      className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-[100]",
        "flex items-center gap-3 w-[calc(100%-2rem)] max-w-sm",
        "px-4 py-3 rounded-xl border shadow-xl backdrop-blur-xl",
        "text-sm font-light animate-in fade-in slide-in-from-bottom-2 duration-300",
        type === "success"
          ? "bg-white/95 border-emerald-200 text-emerald-800"
          : "bg-white/95 border-red-200 text-red-800"
      )}
    >
      {type === "success" ? (
        <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
      ) : (
        <XCircle size={15} className="text-red-500 shrink-0" />
      )}
      <span className="flex-1 leading-snug">{message}</span>
      <button onClick={onClose} className="shrink-0 text-current/40 hover:text-current/70 transition-colors">
        <X size={13} />
      </button>
    </div>
  );
}

// ── Modal wrapper ──────────────────────────────────────────────────────────────

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-2xl border border-black/[0.07] shadow-2xl p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

// ── Shared form fields ─────────────────────────────────────────────────────────

function FormFields({
  title,
  setTitle,
  callType,
  setCallType,
  date,
  setDate,
  time,
  setTime,
  meetingUrl,
  setMeetingUrl,
}: {
  title: string;
  setTitle: (v: string) => void;
  callType: ScheduledCallType;
  setCallType: (v: ScheduledCallType) => void;
  date: string;
  setDate: (v: string) => void;
  time: string;
  setTime: (v: string) => void;
  meetingUrl: string;
  setMeetingUrl: (v: string) => void;
}) {
  return (
    <>
      <div>
        <label className="block text-[10px] text-[#5F6368]/60 font-light mb-1.5">
          Título *
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex: Reunião de Performance — Agosto 2025"
          className="w-full bg-black/[0.03] border border-black/[0.08] rounded-lg px-3 py-2 text-sm text-[#111111]/90 placeholder:text-[#5F6368]/35 font-light focus:outline-none focus:border-vitti-blue/40 transition-colors"
        />
      </div>

      <div>
        <label className="block text-[10px] text-[#5F6368]/60 font-light mb-1.5">
          Tipo / Assunto
        </label>
        <select
          value={callType}
          onChange={(e) => setCallType(e.target.value as ScheduledCallType)}
          className="w-full bg-black/[0.03] border border-black/[0.08] rounded-lg px-3 py-2 text-sm text-[#111111]/90 font-light focus:outline-none focus:border-vitti-blue/40 transition-colors"
        >
          {CALL_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] text-[#5F6368]/60 font-light mb-1.5">
            Data *
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full bg-black/[0.03] border border-black/[0.08] rounded-lg px-3 py-2 text-sm text-[#111111]/90 font-light focus:outline-none focus:border-vitti-blue/40 transition-colors"
          />
        </div>
        <div>
          <label className="block text-[10px] text-[#5F6368]/60 font-light mb-1.5">
            Horário
          </label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full bg-black/[0.03] border border-black/[0.08] rounded-lg px-3 py-2 text-sm text-[#111111]/90 font-light focus:outline-none focus:border-vitti-blue/40 transition-colors"
          />
        </div>
      </div>

      <div>
        <label className="block text-[10px] text-[#5F6368]/60 font-light mb-1.5">
          Link da reunião
        </label>
        <input
          type="url"
          value={meetingUrl}
          onChange={(e) => setMeetingUrl(e.target.value)}
          placeholder="https://meet.google.com/..."
          className="w-full bg-black/[0.03] border border-black/[0.08] rounded-lg px-3 py-2 text-sm text-[#111111]/90 placeholder:text-[#5F6368]/35 font-light focus:outline-none focus:border-vitti-blue/40 transition-colors"
        />
      </div>
    </>
  );
}

// ── CreateModal ────────────────────────────────────────────────────────────────

function CreateModal({
  allClients,
  onClose,
  onCreated,
}: {
  allClients: AdminClientRow[];
  onClose: () => void;
  onCreated: (call: AdminScheduledCallRow) => void;
}) {
  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [callType, setCallType] = useState<ScheduledCallType>("alignment");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!clientId) { setError("Selecione um cliente."); return; }
    if (!title.trim()) { setError("Título é obrigatório."); return; }
    if (!date) { setError("Data é obrigatória."); return; }

    const scheduledAt = new Date(`${date}T${time}:00-03:00`).toISOString();
    setLoading(true);
    try {
      const res = await fetch("/api/admin/scheduled-calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          title: title.trim(),
          callType,
          scheduledAt,
          meetingUrl: meetingUrl.trim() || null,
          status: "upcoming",
        }),
      });
      const json = (await res.json()) as ScheduledCallMutationResponse;
      if (!json.success || !json.call) {
        setError(json.error ?? "Erro ao criar agendamento.");
        return;
      }
      onCreated(json.call);
    } catch {
      setError("Erro de rede. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#111111]/90">Nova reunião agendada</h3>
        <button
          onClick={onClose}
          disabled={loading}
          className="text-[#5F6368]/50 hover:text-[#111111]/75 transition-colors disabled:opacity-40"
        >
          <X size={14} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-[10px] text-[#5F6368]/60 font-light mb-1.5">
            Cliente *
          </label>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="w-full bg-black/[0.03] border border-black/[0.08] rounded-lg px-3 py-2 text-sm text-[#111111]/90 font-light focus:outline-none focus:border-vitti-blue/40 transition-colors"
          >
            <option value="">Selecionar cliente...</option>
            {allClients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <FormFields
          title={title}
          setTitle={setTitle}
          callType={callType}
          setCallType={setCallType}
          date={date}
          setDate={setDate}
          time={time}
          setTime={setTime}
          meetingUrl={meetingUrl}
          setMeetingUrl={setMeetingUrl}
        />

        {error && (
          <div className="flex items-center gap-2 text-[11px] text-red-500/80 bg-red-50 border border-red-200/60 rounded-lg px-3 py-2">
            <AlertCircle size={12} className="shrink-0" />
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-xs font-light text-[#5F6368]/70 hover:text-[#111111]/85 transition-colors disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-xs font-light bg-black/[0.06] hover:bg-black/[0.09] border border-black/[0.08] rounded-lg text-[#111111]/80 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
            Criar agendamento
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
  call: AdminScheduledCallRow;
  onClose: () => void;
  onUpdated: (call: AdminScheduledCallRow) => void;
}) {
  const { date: initDate, time: initTime } = extractLocalDateTime(call.scheduledAt);
  const [title, setTitle] = useState(call.title);
  const [callType, setCallType] = useState<ScheduledCallType>(call.callType);
  const [date, setDate] = useState(initDate);
  const [time, setTime] = useState(initTime);
  const [meetingUrl, setMeetingUrl] = useState(call.meetingUrl ?? "");
  const [status, setStatus] = useState<ScheduledCallStatus>(call.status);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) { setError("Título é obrigatório."); return; }
    if (!date) { setError("Data é obrigatória."); return; }

    const scheduledAt = new Date(`${date}T${time}:00-03:00`).toISOString();
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/scheduled-calls/${call.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          callType,
          scheduledAt,
          meetingUrl: meetingUrl.trim() || null,
          status,
        }),
      });
      const json = (await res.json()) as ScheduledCallMutationResponse;
      if (!json.success || !json.call) {
        setError(json.error ?? "Erro ao salvar alterações.");
        return;
      }
      onUpdated(json.call);
    } catch {
      setError("Erro de rede. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[#111111]/90">Editar reunião</h3>
          <p className="text-[11px] text-[#5F6368]/60 mt-0.5 font-light">
            Cliente: <span className="text-[#111111]/70">{call.clientName}</span>
          </p>
        </div>
        <button
          onClick={onClose}
          disabled={loading}
          className="text-[#5F6368]/50 hover:text-[#111111]/75 transition-colors disabled:opacity-40"
        >
          <X size={14} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <FormFields
          title={title}
          setTitle={setTitle}
          callType={callType}
          setCallType={setCallType}
          date={date}
          setDate={setDate}
          time={time}
          setTime={setTime}
          meetingUrl={meetingUrl}
          setMeetingUrl={setMeetingUrl}
        />

        <div>
          <label className="block text-[10px] text-[#5F6368]/60 font-light mb-1.5">
            Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ScheduledCallStatus)}
            className="w-full bg-black/[0.03] border border-black/[0.08] rounded-lg px-3 py-2 text-sm text-[#111111]/90 font-light focus:outline-none focus:border-vitti-blue/40 transition-colors"
          >
            {SCHEDULED_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-[11px] text-red-500/80 bg-red-50 border border-red-200/60 rounded-lg px-3 py-2">
            <AlertCircle size={12} className="shrink-0" />
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-xs font-light text-[#5F6368]/70 hover:text-[#111111]/85 transition-colors disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-xs font-light bg-black/[0.06] hover:bg-black/[0.09] border border-black/[0.08] rounded-lg text-[#111111]/80 transition-colors disabled:opacity-50 flex items-center gap-2"
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

type TabFilter = "upcoming" | "done" | "cancelled" | "all";

const TAB_OPTIONS: { id: TabFilter; label: string }[] = [
  { id: "upcoming",  label: "Próximas" },
  { id: "done",      label: "Concluídas" },
  { id: "cancelled", label: "Canceladas" },
  { id: "all",       label: "Todas" },
];

export function ScheduledCallsPanel({ allClients }: { allClients: AdminClientRow[] }) {
  const [calls, setCalls] = useState<AdminScheduledCallRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [tabFilter, setTabFilter] = useState<TabFilter>("upcoming");
  const [showCreate, setShowCreate] = useState(false);
  const [editCall, setEditCall] = useState<AdminScheduledCallRow | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const loadCalls = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch("/api/admin/scheduled-calls");
      const json = (await res.json()) as ScheduledCallListResponse;
      if (!json.success) {
        setFetchError(json.error ?? "Erro ao carregar agendamentos.");
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

  useEffect(() => {
    loadCalls();
  }, [loadCalls]);

  async function handleStatusChange(id: string, status: ScheduledCallStatus) {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/scheduled-calls/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = (await res.json()) as ScheduledCallMutationResponse;
      if (!json.success || !json.call) {
        setToast({ type: "error", message: json.error ?? "Erro ao atualizar." });
        return;
      }
      setCalls((prev) => prev.map((c) => (c.id === id ? json.call! : c)));
      setToast({
        type: "success",
        message: `Reunião marcada como ${STATUS_LABELS[status].toLowerCase()}.`,
      });
    } catch {
      setToast({ type: "error", message: "Erro de rede." });
    } finally {
      setActionLoading(null);
    }
  }

  const filtered =
    tabFilter === "all"
      ? calls
      : calls.filter((c) => c.status === tabFilter);

  const upcomingCount = calls.filter((c) => c.status === "upcoming").length;

  return (
    <>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {showCreate && (
        <CreateModal
          allClients={allClients}
          onClose={() => setShowCreate(false)}
          onCreated={(call) => {
            setCalls((prev) => [call, ...prev]);
            setShowCreate(false);
            setToast({ type: "success", message: "Reunião criada com sucesso." });
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
            setToast({ type: "success", message: "Reunião atualizada com sucesso." });
          }}
        />
      )}

      <div className="space-y-4">
        {/* Header row: tabs + actions */}
        <div className="flex items-center gap-1 flex-wrap">
          {TAB_OPTIONS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTabFilter(t.id)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[11px] font-light transition-all",
                tabFilter === t.id
                  ? "bg-black/[0.06] text-[#111111]/85 border border-black/[0.08]"
                  : "text-[#5F6368]/65 hover:text-[#111111]/75 hover:bg-black/[0.03]"
              )}
            >
              {t.label}
              {t.id === "upcoming" && upcomingCount > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-100 text-blue-700/80 text-[9px] font-medium">
                  {upcomingCount}
                </span>
              )}
            </button>
          ))}

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={loadCalls}
              className="text-[#5F6368]/50 hover:text-[#111111]/70 transition-colors"
              title="Recarregar"
            >
              <RefreshCw size={12} />
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-light bg-black/[0.04] hover:bg-black/[0.07] border border-black/[0.08] rounded-lg text-[#111111]/70 transition-colors"
            >
              <Plus size={11} />
              Nova reunião
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={18} className="animate-spin text-[#5F6368]/50" />
          </div>
        )}

        {/* Error */}
        {!loading && fetchError && (
          <div className="flex items-center gap-2 text-[11px] text-red-400/70 bg-red-400/5 border border-red-400/15 rounded-lg px-4 py-3">
            <AlertCircle size={13} className="shrink-0" />
            {fetchError}
          </div>
        )}

        {/* Empty */}
        {!loading && !fetchError && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-2 border border-dashed border-black/[0.08] rounded-xl">
            <CalendarClock size={22} className="text-[#5F6368]/25" />
            <p className="text-[11px] text-[#5F6368]/50 font-light">
              {tabFilter === "upcoming"
                ? "Nenhuma reunião próxima agendada."
                : "Nenhuma reunião nesta categoria."}
            </p>
          </div>
        )}

        {/* Table */}
        {!loading && !fetchError && filtered.length > 0 && (
          <div className="border border-black/[0.07] rounded-xl overflow-hidden">
            <table className="w-full text-xs font-light">
              <thead>
                <tr className="border-b border-black/[0.06] bg-black/[0.02]">
                  <th className="text-left px-4 py-2.5 text-[10px] text-[#5F6368]/55 font-light">
                    Cliente
                  </th>
                  <th className="text-left px-4 py-2.5 text-[10px] text-[#5F6368]/55 font-light">
                    Reunião
                  </th>
                  <th className="text-left px-4 py-2.5 text-[10px] text-[#5F6368]/55 font-light">
                    Data / Hora
                  </th>
                  <th className="text-left px-4 py-2.5 text-[10px] text-[#5F6368]/55 font-light">
                    Link
                  </th>
                  <th className="text-left px-4 py-2.5 text-[10px] text-[#5F6368]/55 font-light">
                    Status
                  </th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((call, idx) => {
                  const isLast = idx === filtered.length - 1;
                  const isActing = actionLoading === call.id;
                  return (
                    <tr
                      key={call.id}
                      className={cn(
                        "border-b border-black/[0.04] hover:bg-black/[0.015] transition-colors",
                        isLast && "border-b-0"
                      )}
                    >
                      <td className="px-4 py-3 max-w-[120px]">
                        <div className="truncate text-[#111111]/80">{call.clientName}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-[#111111]/80 font-light">{call.title}</div>
                        <div className="text-[9px] text-[#5F6368]/50 mt-0.5">
                          {TYPE_LABELS[call.callType]}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[11px] text-[#5F6368]/70 whitespace-nowrap">
                        {formatScheduledAt(call.scheduledAt)}
                      </td>
                      <td className="px-4 py-3">
                        {call.meetingUrl ? (
                          <a
                            href={call.meetingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] text-vitti-blue/60 hover:text-vitti-blue transition-colors"
                          >
                            <ExternalLink size={9} />
                            Abrir
                          </a>
                        ) : (
                          <span className="text-[10px] text-[#5F6368]/35">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-light",
                            STATUS_STYLES[call.status]
                          )}
                        >
                          {STATUS_LABELS[call.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end whitespace-nowrap">
                          {isActing ? (
                            <Loader2
                              size={11}
                              className="animate-spin text-[#5F6368]/50"
                            />
                          ) : (
                            <>
                              <button
                                onClick={() => setEditCall(call)}
                                className="text-[#5F6368]/50 hover:text-[#111111]/75 transition-colors"
                                title="Editar"
                              >
                                <Pencil size={11} />
                              </button>
                              {call.status === "upcoming" && (
                                <>
                                  <span className="text-black/[0.12]">·</span>
                                  <button
                                    onClick={() => handleStatusChange(call.id, "done")}
                                    className="text-[10px] text-emerald-600/60 hover:text-emerald-600 font-light transition-colors"
                                  >
                                    Concluir
                                  </button>
                                  <span className="text-black/[0.12]">·</span>
                                  <button
                                    onClick={() => handleStatusChange(call.id, "cancelled")}
                                    className="text-[10px] text-[#5F6368]/50 hover:text-red-500/70 font-light transition-colors"
                                  >
                                    Cancelar
                                  </button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

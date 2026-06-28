"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2,
  AlertCircle,
  RefreshCw,
  Calendar,
  CheckCircle2,
  XCircle,
  X,
  Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdminMeetingRequestRow, MeetingRequestStatus } from "@/lib/data/meeting-requests-admin";
import type { AdminClientRow } from "@/lib/data/clients-admin";
import type { ScheduledCallType } from "@/lib/data/scheduled-calls-admin";

// ── Local response types ───────────────────────────────────────────────────────

interface MeetingRequestListResponse {
  success: boolean;
  requests?: AdminMeetingRequestRow[];
  error?: string;
}

interface ScheduledCallCreateResponse {
  success: boolean;
  error?: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<MeetingRequestStatus, string> = {
  pending:   "Pendente",
  scheduled: "Agendada",
  cancelled: "Cancelada",
  done:      "Concluída",
};

const STATUS_STYLES: Record<MeetingRequestStatus, string> = {
  pending:   "border-amber-400/40 text-amber-700/80 bg-amber-50",
  scheduled: "border-blue-400/40 text-blue-700/80 bg-blue-50",
  done:      "border-emerald-400/40 text-emerald-700/80 bg-emerald-50",
  cancelled: "border-black/[0.08] text-[#5F6368]/55 bg-black/[0.02]",
};

const SHIFT_LABELS: Record<"morning" | "afternoon", string> = {
  morning:   "Manhã",
  afternoon: "Tarde",
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

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatRequestDate(iso: string): string {
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

// ── ScheduleModal ──────────────────────────────────────────────────────────────

function ScheduleModal({
  request,
  onClose,
  onScheduled,
}: {
  request: AdminMeetingRequestRow;
  onClose: () => void;
  onScheduled: () => void;
}) {
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
    if (!title.trim()) { setError("Título é obrigatório."); return; }
    if (!date) { setError("Data é obrigatória."); return; }

    // Interpret date+time as São Paulo time (UTC-3)
    const scheduledAt = new Date(`${date}T${time}:00-03:00`).toISOString();
    setLoading(true);

    try {
      const res1 = await fetch("/api/admin/scheduled-calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: request.clientId,
          title: title.trim(),
          callType,
          scheduledAt,
          meetingUrl: meetingUrl.trim() || null,
          status: "upcoming",
        }),
      });
      const json1 = (await res1.json()) as ScheduledCallCreateResponse;
      if (!json1.success) {
        setError(json1.error ?? "Erro ao criar agendamento.");
        return;
      }

      // Update request status to 'scheduled'
      await fetch(`/api/admin/meeting-requests/${request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "scheduled" }),
      });

      onScheduled();
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
          <h3 className="text-sm font-semibold text-[#111111]/90">Agendar reunião</h3>
          <p className="text-[11px] text-[#5F6368]/60 mt-0.5 font-light">
            Cliente: <span className="text-[#111111]/70">{request.clientName}</span>
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

      {/* Solicitação original */}
      <div className="bg-black/[0.025] border border-black/[0.06] rounded-lg px-3 py-2.5 space-y-1">
        <p className="text-[9px] text-[#5F6368]/50 uppercase tracking-widest font-light">
          Solicitação original
        </p>
        <p className="text-[11px] text-[#111111]/70 font-light leading-relaxed">
          <span className="font-medium">{request.userName}</span>
          {" · "}
          {SHIFT_LABELS[request.shift]}
          {" · "}
          {request.reason.length > 100
            ? request.reason.slice(0, 100) + "…"
            : request.reason}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-[10px] text-[#5F6368]/60 font-light mb-1.5">
            Título *
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Reunião de Alinhamento — Julho 2025"
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
            className="px-4 py-2 text-xs font-light bg-vitti-blue/90 hover:bg-vitti-blue text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Calendar size={12} />
            )}
            Criar reunião
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Main Panel ─────────────────────────────────────────────────────────────────

type TabFilter = "pending" | "scheduled" | "done" | "cancelled" | "all";

const TAB_OPTIONS: { id: TabFilter; label: string }[] = [
  { id: "pending",   label: "Pendentes" },
  { id: "scheduled", label: "Agendadas" },
  { id: "done",      label: "Concluídas" },
  { id: "cancelled", label: "Canceladas" },
  { id: "all",       label: "Todas" },
];

export function MeetingRequestsPanel({
  allClients: _,
}: {
  allClients: AdminClientRow[];
}) {
  const [requests, setRequests] = useState<AdminMeetingRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [tabFilter, setTabFilter] = useState<TabFilter>("pending");
  const [scheduleFor, setScheduleFor] = useState<AdminMeetingRequestRow | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch("/api/admin/meeting-requests");
      const json = (await res.json()) as MeetingRequestListResponse;
      if (!json.success) {
        setFetchError(json.error ?? "Erro ao carregar solicitações.");
        setRequests([]);
      } else {
        setRequests(json.requests ?? []);
      }
    } catch {
      setFetchError("Erro de rede.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  async function handleStatusChange(id: string, status: MeetingRequestStatus) {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/meeting-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json() as { success: boolean; error?: string };
      if (!json.success) {
        setToast({ type: "error", message: json.error ?? "Erro ao atualizar." });
        return;
      }
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status } : r))
      );
      setToast({
        type: "success",
        message: `Solicitação marcada como ${STATUS_LABELS[status].toLowerCase()}.`,
      });
    } catch {
      setToast({ type: "error", message: "Erro de rede." });
    } finally {
      setActionLoading(null);
    }
  }

  const filtered =
    tabFilter === "all"
      ? requests
      : requests.filter((r) => r.status === tabFilter);

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {scheduleFor && (
        <ScheduleModal
          request={scheduleFor}
          onClose={() => setScheduleFor(null)}
          onScheduled={() => {
            const id = scheduleFor.id;
            setScheduleFor(null);
            setRequests((prev) =>
              prev.map((r) => (r.id === id ? { ...r, status: "scheduled" } : r))
            );
            setToast({
              type: "success",
              message: "Reunião criada e solicitação atualizada com sucesso.",
            });
          }}
        />
      )}

      <div className="space-y-4">
        {/* Tab bar + reload */}
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
              {t.id === "pending" && pendingCount > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-100 text-amber-700/80 text-[9px] font-medium">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
          <button
            onClick={loadRequests}
            className="ml-auto text-[#5F6368]/50 hover:text-[#111111]/70 transition-colors"
            title="Recarregar"
          >
            <RefreshCw size={12} />
          </button>
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
            <Inbox size={22} className="text-[#5F6368]/25" />
            <p className="text-[11px] text-[#5F6368]/50 font-light">
              {tabFilter === "pending"
                ? "Nenhuma solicitação pendente."
                : "Nenhuma solicitação nesta categoria."}
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
                    Solicitante
                  </th>
                  <th className="text-left px-4 py-2.5 text-[10px] text-[#5F6368]/55 font-light">
                    Turno
                  </th>
                  <th className="text-left px-4 py-2.5 text-[10px] text-[#5F6368]/55 font-light">
                    Motivo
                  </th>
                  <th className="text-left px-4 py-2.5 text-[10px] text-[#5F6368]/55 font-light">
                    Recebido em
                  </th>
                  <th className="text-left px-4 py-2.5 text-[10px] text-[#5F6368]/55 font-light">
                    Status
                  </th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((req, idx) => {
                  const isLast = idx === filtered.length - 1;
                  const isActing = actionLoading === req.id;
                  return (
                    <tr
                      key={req.id}
                      className={cn(
                        "border-b border-black/[0.04] hover:bg-black/[0.015] transition-colors",
                        isLast && "border-b-0"
                      )}
                    >
                      <td className="px-4 py-3 max-w-[130px]">
                        <div className="truncate text-[#111111]/80">{req.clientName}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-[#111111]/80">{req.userName}</div>
                        <div className="text-[9px] text-[#5F6368]/50 mt-0.5">
                          {req.userEmail}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#5F6368]/70 whitespace-nowrap">
                        {SHIFT_LABELS[req.shift]}
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        <div
                          className="truncate text-[11px] text-[#5F6368]/70"
                          title={req.reason}
                        >
                          {req.reason}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[11px] text-[#5F6368]/60 whitespace-nowrap">
                        {formatRequestDate(req.requestedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-light",
                            STATUS_STYLES[req.status]
                          )}
                        >
                          {STATUS_LABELS[req.status]}
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
                              {req.status === "pending" && (
                                <>
                                  <button
                                    onClick={() => setScheduleFor(req)}
                                    className="text-[10px] text-vitti-blue/70 hover:text-vitti-blue font-light transition-colors flex items-center gap-1"
                                  >
                                    <Calendar size={10} />
                                    Agendar
                                  </button>
                                  <span className="text-black/[0.12]">·</span>
                                  <button
                                    onClick={() => handleStatusChange(req.id, "done")}
                                    className="text-[10px] text-emerald-600/60 hover:text-emerald-600 font-light transition-colors"
                                  >
                                    Concluir
                                  </button>
                                  <span className="text-black/[0.12]">·</span>
                                  <button
                                    onClick={() => handleStatusChange(req.id, "cancelled")}
                                    className="text-[10px] text-[#5F6368]/50 hover:text-red-500/70 font-light transition-colors"
                                  >
                                    Cancelar
                                  </button>
                                </>
                              )}
                              {req.status === "scheduled" && (
                                <>
                                  <button
                                    onClick={() => handleStatusChange(req.id, "done")}
                                    className="text-[10px] text-emerald-600/60 hover:text-emerald-600 font-light transition-colors"
                                  >
                                    Concluir
                                  </button>
                                  <span className="text-black/[0.12]">·</span>
                                  <button
                                    onClick={() => handleStatusChange(req.id, "cancelled")}
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

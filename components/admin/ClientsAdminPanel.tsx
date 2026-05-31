"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Plus,
  Search,
  Pencil,
  Power,
  LayoutDashboard,
  X,
  Check,
  AlertCircle,
  Loader2,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdminClientRow } from "@/lib/data/clients-admin";
import type { ClientsListResponse, ClientCreateResponse } from "@/app/api/admin/clients/route";
import type { ClientUpdateResponse } from "@/app/api/admin/clients/[id]/route";
import type { EnsureDashboardResponse } from "@/app/api/admin/clients/[id]/ensure-dashboard/route";

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugifyName(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function fmtDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const active = status === "active";
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-light tracking-wide border",
        active
          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
          : "bg-black/[0.04] text-[#5F6368]/60 border-black/[0.08]"
      )}
    >
      {active ? "Ativo" : "Inativo"}
    </span>
  );
}

// ── Form state ────────────────────────────────────────────────────────────────

interface FormState {
  name: string;
  slug: string;
  segment: string;
  status: "active" | "inactive";
  slugEdited: boolean;
}

const emptyForm = (): FormState => ({
  name: "",
  slug: "",
  segment: "",
  status: "active",
  slugEdited: false,
});

function formFromClient(c: AdminClientRow): FormState {
  return {
    name: c.name,
    slug: c.slug,
    segment: c.segment ?? "",
    status: c.status === "inactive" ? "inactive" : "active",
    slugEdited: true,
  };
}

// ── Modal ─────────────────────────────────────────────────────────────────────

interface ModalProps {
  mode: "create" | "edit";
  form: FormState;
  onChange: (patch: Partial<FormState>) => void;
  onSubmit: () => void;
  onClose: () => void;
  saving: boolean;
  errorMsg: string | null;
}

function ClientModal({
  mode,
  form,
  onChange,
  onSubmit,
  onClose,
  saving,
  errorMsg,
}: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Card */}
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-black/[0.08] bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.07]">
          <h3 className="text-sm font-light text-[#111111]/90">
            {mode === "create" ? "Novo cliente" : "Editar cliente"}
          </h3>
          <button
            onClick={onClose}
            className="text-[#5F6368]/55 hover:text-[#111111]/75 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-[10px] text-[#5F6368]/60 font-light mb-1.5 tracking-wide uppercase">
              Nome *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => {
                const name = e.target.value;
                onChange({
                  name,
                  ...(form.slugEdited ? {} : { slug: slugifyName(name) }),
                });
              }}
              placeholder="Ex: Berloca Burguer"
              className="w-full bg-black/[0.03] border border-black/[0.08] rounded-lg px-3.5 py-2.5 text-sm font-light text-[#111111]/90 placeholder-[#5F6368]/40 focus:outline-none focus:border-vitti-blue/40 transition-colors"
            />
          </div>

          {/* Slug */}
          <div>
            <label className="block text-[10px] text-[#5F6368]/60 font-light mb-1.5 tracking-wide uppercase">
              Slug *
            </label>
            <input
              type="text"
              value={form.slug}
              onChange={(e) =>
                onChange({ slug: e.target.value, slugEdited: true })
              }
              placeholder="ex: berloca-burguer"
              className="w-full bg-black/[0.03] border border-black/[0.08] rounded-lg px-3.5 py-2.5 text-sm font-light font-mono text-[#111111]/80 placeholder-[#5F6368]/40 focus:outline-none focus:border-vitti-blue/40 transition-colors"
            />
            <p className="text-[9px] text-[#5F6368]/50 font-light mt-1.5">
              Gerado automaticamente · apenas letras, números e hífens
            </p>
          </div>

          {/* Segment */}
          <div>
            <label className="block text-[10px] text-[#5F6368]/60 font-light mb-1.5 tracking-wide uppercase">
              Segmento
            </label>
            <input
              type="text"
              value={form.segment}
              onChange={(e) => onChange({ segment: e.target.value })}
              placeholder="Ex: Gastronomia, E-commerce…"
              className="w-full bg-black/[0.03] border border-black/[0.08] rounded-lg px-3.5 py-2.5 text-sm font-light text-[#111111]/90 placeholder-[#5F6368]/40 focus:outline-none focus:border-vitti-blue/40 transition-colors"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-[10px] text-[#5F6368]/60 font-light mb-1.5 tracking-wide uppercase">
              Status
            </label>
            <div className="flex gap-2">
              {(["active", "inactive"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => onChange({ status: s })}
                  className={cn(
                    "flex-1 py-2 rounded-lg border text-[11px] font-light transition-all",
                    form.status === s
                      ? s === "active"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                        : "border-black/[0.10] bg-black/[0.05] text-[#5F6368]/80"
                      : "border-black/[0.07] text-[#5F6368]/50 hover:border-black/[0.10]"
                  )}
                >
                  {s === "active" ? "Ativo" : "Inativo"}
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {errorMsg && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/15 bg-red-500/[0.04] px-3.5 py-2.5">
              <AlertCircle size={12} className="text-red-400/60 shrink-0 mt-0.5" />
              <p className="text-[11px] font-light text-red-400/70">{errorMsg}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-black/[0.07]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[11px] font-light text-[#5F6368]/70 hover:text-[#111111]/85 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onSubmit}
            disabled={saving || !form.name.trim() || !form.slug.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-vitti-blue/30 bg-vitti-blue/10 text-vitti-light/80 hover:bg-vitti-blue/20 hover:text-vitti-light text-[11px] font-light transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving && <Loader2 size={11} className="animate-spin" />}
            {mode === "create" ? "Criar cliente" : "Salvar alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Feedback toast (inline) ───────────────────────────────────────────────────

interface FeedbackState {
  clientId: string;
  type: "success" | "error";
  message: string;
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function ClientsAdminPanel({
  initialClients,
}: {
  initialClients: AdminClientRow[];
}) {
  const [clients, setClients] = useState(initialClients);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // Modal state
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [editingClient, setEditingClient] = useState<AdminClientRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [modalError, setModalError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Per-client action loading
  const [actionLoading, setActionLoading] = useState<Record<string, string>>({});
  // Per-client feedback
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  // ── Filtered list ────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    return clients.filter((c) => {
      const matchSearch =
        !search ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.slug.toLowerCase().includes(search.toLowerCase()) ||
        (c.segment ?? "").toLowerCase().includes(search.toLowerCase());
      const matchStatus =
        statusFilter === "all" || c.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [clients, search, statusFilter]);

  // ── Refresh list ─────────────────────────────────────────────────────────

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/clients");
      const json: ClientsListResponse = await res.json();
      if (json.success) setClients(json.clients);
    } catch {
      // silent — stale data is acceptable
    }
  }, []);

  // ── Show feedback per client ─────────────────────────────────────────────

  function showFeedback(clientId: string, type: "success" | "error", message: string) {
    setFeedback({ clientId, type, message });
    setTimeout(() => setFeedback(null), 3000);
  }

  // ── Modal helpers ────────────────────────────────────────────────────────

  function openCreate() {
    setForm(emptyForm());
    setModalError(null);
    setModal("create");
  }

  function openEdit(client: AdminClientRow) {
    setForm(formFromClient(client));
    setEditingClient(client);
    setModalError(null);
    setModal("edit");
  }

  function closeModal() {
    setModal(null);
    setEditingClient(null);
    setModalError(null);
  }

  function patchForm(patch: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  // ── Create ───────────────────────────────────────────────────────────────

  async function handleCreate() {
    setSaving(true);
    setModalError(null);
    try {
      const res = await fetch("/api/admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          slug: form.slug,
          segment: form.segment || null,
          status: form.status,
        }),
      });
      const json: ClientCreateResponse = await res.json();
      if (!json.success) {
        setModalError(
          json.detail
            ? `${json.error ?? "Erro."} — ${json.detail}`
            : (json.error ?? "Erro ao criar cliente.")
        );
        return;
      }
      await refresh();
      closeModal();
    } catch (e) {
      setModalError(e instanceof Error ? e.message : "Erro de conexão.");
    } finally {
      setSaving(false);
    }
  }

  // ── Update ───────────────────────────────────────────────────────────────

  async function handleUpdate() {
    if (!editingClient) return;
    setSaving(true);
    setModalError(null);
    try {
      const res = await fetch(`/api/admin/clients/${editingClient.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          slug: form.slug,
          segment: form.segment || null,
          status: form.status,
        }),
      });
      const json: ClientUpdateResponse = await res.json();
      if (!json.success) {
        setModalError(
          json.detail
            ? `${json.error ?? "Erro."} — ${json.detail}`
            : (json.error ?? "Erro ao atualizar cliente.")
        );
        return;
      }
      await refresh();
      closeModal();
    } catch (e) {
      setModalError(e instanceof Error ? e.message : "Erro de conexão.");
    } finally {
      setSaving(false);
    }
  }

  // ── Toggle status ────────────────────────────────────────────────────────

  async function handleToggleStatus(client: AdminClientRow) {
    const newStatus = client.status === "active" ? "inactive" : "active";
    setActionLoading((prev) => ({ ...prev, [client.id]: "status" }));
    try {
      const res = await fetch(`/api/admin/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const json: ClientUpdateResponse = await res.json();
      if (!json.success) {
        showFeedback(client.id, "error", json.error ?? "Erro ao alterar status.");
        return;
      }
      setClients((prev) =>
        prev.map((c) => (c.id === client.id ? { ...c, status: newStatus } : c))
      );
      showFeedback(
        client.id,
        "success",
        newStatus === "active" ? "Cliente ativado." : "Cliente desativado."
      );
    } catch {
      showFeedback(client.id, "error", "Erro de conexão.");
    } finally {
      setActionLoading((prev) => {
        const next = { ...prev };
        delete next[client.id];
        return next;
      });
    }
  }

  // ── Ensure dashboard ─────────────────────────────────────────────────────

  async function handleEnsureDashboard(client: AdminClientRow) {
    setActionLoading((prev) => ({ ...prev, [client.id]: "dashboard" }));
    try {
      const res = await fetch(`/api/admin/clients/${client.id}/ensure-dashboard`, {
        method: "POST",
      });
      const json: EnsureDashboardResponse = await res.json();
      if (!json.success) {
        const msg = json.detail
          ? `${json.error ?? "Erro."} — ${json.detail}`
          : (json.error ?? "Erro ao garantir dashboard.");
        showFeedback(client.id, "error", msg);
        return;
      }
      const summary =
        json.message ??
        `${json.totalBlocks ?? 0} blocos · ${json.totalMetrics ?? 0} métricas`;
      showFeedback(client.id, "success", summary);
      await refresh();
    } catch {
      showFeedback(client.id, "error", "Erro de conexão.");
    } finally {
      setActionLoading((prev) => {
        const next = { ...prev };
        delete next[client.id];
        return next;
      });
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const counts = useMemo(
    () => ({
      all: clients.length,
      active: clients.filter((c) => c.status === "active").length,
      inactive: clients.filter((c) => c.status === "inactive").length,
    }),
    [clients]
  );

  return (
    <div className="space-y-5">
      {/* ── Toolbar ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search
            size={12}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5F6368]/50"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, slug ou segmento…"
            className="w-full bg-black/[0.03] border border-black/[0.08] rounded-lg pl-8 pr-3 py-2 text-[11px] font-light text-[#111111]/80 placeholder-[#5F6368]/40 focus:outline-none focus:border-vitti-blue/30 transition-colors"
          />
        </div>

        {/* Status filter */}
        <div className="flex rounded-lg border border-black/[0.08] overflow-hidden shrink-0">
          {(["all", "active", "inactive"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={cn(
                "px-3 py-2 text-[10px] font-light transition-colors",
                statusFilter === f
                  ? "bg-black/[0.06] text-[#111111]/80"
                  : "text-[#5F6368]/55 hover:text-[#111111]/70 hover:bg-black/[0.02]",
                f !== "all" && "border-l border-black/[0.07]"
              )}
            >
              {f === "all" ? `Todos (${counts.all})` : f === "active" ? `Ativos (${counts.active})` : `Inativos (${counts.inactive})`}
            </button>
          ))}
        </div>

        {/* New client */}
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-vitti-blue/30 bg-vitti-blue/10 text-vitti-light/80 hover:bg-vitti-blue/20 hover:text-vitti-light text-[11px] font-light transition-all shrink-0"
        >
          <Plus size={12} />
          Novo cliente
        </button>
      </div>

      {/* ── Table ────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-black/[0.07] overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[2fr_1fr_1fr_auto_auto_auto_auto] gap-x-4 px-5 py-3 bg-black/[0.02] border-b border-black/[0.06]">
          {(["Cliente", "Segmento", "Status", "Dash.", "Windsor", "Criado", ""] as const).map(
            (h) => (
              <p
                key={h}
                className="text-[9px] text-[#5F6368]/50 uppercase tracking-[0.15em] font-light"
              >
                {h}
              </p>
            )
          )}
        </div>

        {/* Rows */}
        {filtered.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-[11px] text-[#5F6368]/50 font-light">
              {search || statusFilter !== "all"
                ? "Nenhum cliente encontrado para o filtro atual."
                : "Nenhum cliente cadastrado ainda."}
            </p>
          </div>
        ) : (
          filtered.map((client, i) => {
            const isLoading = actionLoading[client.id];
            const fb = feedback?.clientId === client.id ? feedback : null;

            return (
              <div key={client.id}>
                <div
                  className={cn(
                    "grid grid-cols-[2fr_1fr_1fr_auto_auto_auto_auto] gap-x-4 px-5 py-3.5 items-center text-[11px] font-light transition-colors hover:bg-black/[0.02]",
                    i < filtered.length - 1 && "border-b border-black/[0.04]"
                  )}
                >
                  {/* Name + slug */}
                  <div className="min-w-0">
                    <p className="text-[#111111]/80 truncate">{client.name}</p>
                    <p className="text-[9px] font-mono text-[#5F6368]/55 truncate mt-0.5">
                      {client.slug}
                    </p>
                  </div>

                  {/* Segment */}
                  <p className="text-[#5F6368]/65 truncate">
                    {client.segment ?? <span className="text-[#5F6368]/35">—</span>}
                  </p>

                  {/* Status */}
                  <StatusBadge status={client.status} />

                  {/* Dashboards */}
                  <p
                    className={cn(
                      "tabular-nums text-center w-8",
                      client.publishedDashboards > 0
                        ? "text-emerald-400/70"
                        : "text-[#5F6368]/50"
                    )}
                  >
                    {client.publishedDashboards}
                  </p>

                  {/* Windsor mappings */}
                  <p
                    className={cn(
                      "tabular-nums text-center w-8",
                      client.windsorMappings > 0
                        ? "text-vitti-light/60"
                        : "text-[#5F6368]/50"
                    )}
                  >
                    {client.windsorMappings}
                  </p>

                  {/* Created at */}
                  <p className="text-[#5F6368]/55 tabular-nums w-24">
                    {fmtDate(client.created_at)}
                  </p>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 justify-end">
                    {/* Edit */}
                    <button
                      onClick={() => openEdit(client)}
                      disabled={!!isLoading}
                      title="Editar"
                      className="w-7 h-7 flex items-center justify-center rounded-lg border border-black/[0.07] text-[#5F6368]/60 hover:text-[#111111]/85 hover:border-black/[0.10] transition-all disabled:opacity-30"
                    >
                      <Pencil size={11} />
                    </button>

                    {/* Ensure dashboard */}
                    <button
                      onClick={() => handleEnsureDashboard(client)}
                      disabled={!!isLoading}
                      title="Garantir dashboard padrão"
                      className="w-7 h-7 flex items-center justify-center rounded-lg border border-black/[0.07] text-[#5F6368]/60 hover:text-vitti-light/60 hover:border-vitti-blue/20 transition-all disabled:opacity-30"
                    >
                      {isLoading === "dashboard" ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        <LayoutDashboard size={11} />
                      )}
                    </button>

                    {/* Toggle status */}
                    <button
                      onClick={() => handleToggleStatus(client)}
                      disabled={!!isLoading}
                      title={client.status === "active" ? "Desativar" : "Ativar"}
                      className={cn(
                        "w-7 h-7 flex items-center justify-center rounded-lg border transition-all disabled:opacity-30",
                        client.status === "active"
                          ? "border-black/[0.07] text-[#5F6368]/60 hover:text-red-400/70 hover:border-red-400/20"
                          : "border-black/[0.07] text-[#5F6368]/60 hover:text-emerald-400/70 hover:border-emerald-400/20"
                      )}
                    >
                      {isLoading === "status" ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        <Power size={11} />
                      )}
                    </button>
                  </div>
                </div>

                {/* Inline feedback */}
                {fb && (
                  <div
                    className={cn(
                      "px-5 py-2 flex items-center gap-2 text-[10px] font-light border-b border-black/[0.04]",
                      fb.type === "success"
                        ? "bg-emerald-500/[0.04] text-emerald-400/70"
                        : "bg-red-500/[0.04] text-red-400/60"
                    )}
                  >
                    {fb.type === "success" ? (
                      <Check size={11} className="shrink-0" />
                    ) : (
                      <AlertCircle size={11} className="shrink-0" />
                    )}
                    {fb.message}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal */}
      {modal && (
        <ClientModal
          mode={modal}
          form={form}
          onChange={patchForm}
          onSubmit={modal === "create" ? handleCreate : handleUpdate}
          onClose={closeModal}
          saving={saving}
          errorMsg={modalError}
        />
      )}
    </div>
  );
}

// ── Back link (exported separately for use in page header) ────────────────────

export function BackToAdmin() {
  return (
    <a
      href="/admin"
      className="inline-flex items-center gap-1.5 text-[10px] font-light text-[#5F6368]/60 hover:text-[#111111]/75 transition-colors"
    >
      <ChevronLeft size={12} />
      Admin
    </a>
  );
}

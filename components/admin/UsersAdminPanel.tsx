"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Users,
  Search,
  X,
  ShieldCheck,
  User,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import type { AdminUserRow, AdminUserDetail, AdminPermission } from "@/lib/data/users-admin";
import type { AdminClientRow } from "@/lib/data/clients-admin";
import type { UserDetailResponse, UserPatchResponse } from "@/app/api/admin/users/[id]/route";
import type { UserClientPatchResponse } from "@/app/api/admin/users/[id]/client/route";
import type { UserPermissionsPatchResponse } from "@/app/api/admin/users/[id]/permissions/route";
import type { GlobalRole } from "@/types";

// ── Helpers ────────────────────────────────────────────────────────────────────

function initials(name: string | null, email: string | null): string {
  const src = name ?? email ?? "?";
  return src
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join("");
}

// ── Role constants ─────────────────────────────────────────────────────────────

const GLOBAL_ROLE_LABELS: Record<GlobalRole, string> = {
  vitti_admin: "Vitti Admin",
  client_user: "Usuário de Cliente",
};

type ClientRole = "admin" | "finance" | "team" | "custom";

const CLIENT_ROLE_LABELS: Record<ClientRole, string> = {
  admin:   "Administrador do Cliente",
  finance: "Financeiro",
  team:    "Equipe",
  custom:  "Personalizado",
};

const CLIENT_ROLE_DESCRIPTIONS: Record<ClientRole, string> = {
  admin:   "Acesso completo ao portal do cliente",
  finance: "Foco em financeiro e relatórios",
  team:    "Acesso operacional sem financeiro",
  custom:  "Configure as permissões manualmente",
};

const ROLE_PRESETS: Record<ClientRole, string[]> = {
  admin:   ["view_home", "view_metrics", "view_reports", "view_finance", "view_calls", "view_education"],
  finance: ["view_home", "view_finance", "view_reports"],
  team:    ["view_home", "view_metrics", "view_reports", "view_calls", "view_education"],
  custom:  [],
};

function normalizeClientRole(role: string | null): ClientRole {
  if (role === "admin" || role === "finance" || role === "team") return role;
  return "custom";
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

// ── User row ───────────────────────────────────────────────────────────────────

function UserRow({
  user,
  onEdit,
}: {
  user: AdminUserRow;
  onEdit: (id: string) => void;
}) {
  const isAdmin = user.globalRole === "vitti_admin";
  const isActive = user.status === "active";
  const ini = initials(user.name, user.email);
  const clientRoleLabel = user.clientUserRole
    ? (CLIENT_ROLE_LABELS[user.clientUserRole as ClientRole] ?? user.clientUserRole)
    : null;

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/[0.05] bg-white/[0.02] hover:border-white/[0.10] hover:bg-white/[0.03] transition-all group">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-vitti-medium/20 border border-vitti-medium/20 flex items-center justify-center shrink-0">
        <span className="text-[10px] font-light text-vitti-light/60">{ini}</span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[12px] font-light text-white/80 truncate">
            {user.name ?? "Sem nome"}
          </span>
          <span
            className={`text-[8px] font-light px-1.5 py-0.5 rounded border ${
              isAdmin
                ? "border-vitti-medium/30 text-vitti-light/60 bg-vitti-medium/10"
                : "border-white/[0.08] text-white/30 bg-white/[0.02]"
            }`}
          >
            {GLOBAL_ROLE_LABELS[user.globalRole]}
          </span>
          {isActive ? (
            <CheckCircle2 size={10} className="text-emerald-400/60 shrink-0" />
          ) : (
            <XCircle size={10} className="text-red-400/50 shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          <span className="text-[10px] font-light text-white/30 truncate">
            {user.email ?? "—"}
          </span>
          {user.clientName && (
            <span className="text-[9px] font-light text-vitti-light/40 shrink-0">
              {clientRoleLabel ? `${clientRoleLabel} · ` : ""}
              {user.clientName}
            </span>
          )}
          {user.permissionCount > 0 && (
            <span className="text-[9px] font-light text-white/20 shrink-0">
              {user.permissionCount} permiss{user.permissionCount === 1 ? "ão" : "ões"}
            </span>
          )}
        </div>
      </div>

      <button
        onClick={() => onEdit(user.id)}
        className="shrink-0 flex items-center gap-1 text-[9px] font-light text-white/20 hover:text-vitti-light/70 transition-colors px-2 py-1 rounded-lg hover:bg-white/[0.04]"
      >
        Editar
        <ChevronRight size={10} />
      </button>
    </div>
  );
}

// ── Save button ────────────────────────────────────────────────────────────────

type SaveState = "idle" | "saving" | "saved" | "error";

function SaveButton({
  state,
  onClick,
  label,
}: {
  state: SaveState;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={state === "saving"}
      className={`text-[9px] font-light px-3 py-1.5 rounded-full border transition-all disabled:cursor-not-allowed ${
        state === "saved"
          ? "border-emerald-400/30 text-emerald-400/70 bg-emerald-400/5"
          : state === "error"
            ? "border-red-400/30 text-red-400/60 bg-red-400/5"
            : "border-vitti-medium/40 text-vitti-light/60 hover:border-vitti-medium/70 hover:text-vitti-light/90 disabled:opacity-40"
      }`}
    >
      {state === "saving" ? (
        <span className="flex items-center gap-1.5">
          <Loader2 size={9} className="animate-spin" />
          Salvando…
        </span>
      ) : state === "saved" ? (
        "Salvo!"
      ) : state === "error" ? (
        "Erro — tentar novamente"
      ) : (
        label
      )}
    </button>
  );
}

// ── Edit modal ─────────────────────────────────────────────────────────────────

function EditModal({
  userId,
  allPermissions,
  allClients,
  onClose,
  onSaved,
}: {
  userId: string;
  allPermissions: AdminPermission[];
  allClients: AdminClientRow[];
  onClose: () => void;
  onSaved: (updated: Partial<AdminUserRow> & { id: string }) => void;
}) {
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Profile
  const [profileName, setProfileName] = useState("");
  const [profileStatus, setProfileStatus] = useState<"active" | "inactive">("active");
  const [profileRole, setProfileRole] = useState<GlobalRole>("client_user");
  const [profileSaveState, setProfileSaveState] = useState<SaveState>("idle");

  // Client + role
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [clientUserRole, setClientUserRole] = useState<ClientRole>("team");
  const [clientSaveState, setClientSaveState] = useState<SaveState>("idle");

  // Permissions
  const [selectedPermIds, setSelectedPermIds] = useState<Set<string>>(new Set());
  const [permSaveState, setPermSaveState] = useState<SaveState>("idle");

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/admin/users/${userId}`, { method: "GET" })
      .then((r) => r.json() as Promise<UserDetailResponse>)
      .then((json) => {
        if (cancelled) return;
        if (!json.success || !json.user) {
          setFetchError(json.error ?? "Erro ao carregar usuário.");
          return;
        }
        const u = json.user;
        setDetail(u);
        setProfileName(u.name ?? "");
        setProfileStatus(u.status === "active" ? "active" : "inactive");
        setProfileRole(u.globalRole);
        setSelectedClientId(u.client?.id ?? "");
        setClientUserRole(normalizeClientRole(u.clientUserRole ?? null));
        setSelectedPermIds(new Set(u.permissionIds));
      })
      .catch(() => {
        if (!cancelled) setFetchError("Erro de conexão.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const handleSaveProfile = useCallback(async () => {
    setProfileSaveState("saving");
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profileName.trim() || null,
          status: profileStatus,
          globalRole: profileRole,
        }),
      });
      const json: UserPatchResponse = await res.json();
      if (!json.success) throw new Error(json.error);
      setProfileSaveState("saved");
      onSaved({ id: userId, name: profileName.trim() || null, status: profileStatus, globalRole: profileRole });
      setTimeout(() => setProfileSaveState("idle"), 2500);
    } catch {
      setProfileSaveState("error");
      setTimeout(() => setProfileSaveState("idle"), 3000);
    }
  }, [userId, profileName, profileStatus, profileRole, onSaved]);

  const handleSaveClient = useCallback(async () => {
    setClientSaveState("saving");
    const clientId = selectedClientId || null;
    try {
      const res = await fetch(`/api/admin/users/${userId}/client`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          ...(clientId ? { role: clientUserRole } : {}),
        }),
      });
      const json: UserClientPatchResponse = await res.json();
      if (!json.success) throw new Error(json.error);
      setClientSaveState("saved");
      const client = allClients.find((c) => c.id === clientId);
      onSaved({
        id: userId,
        clientId,
        clientName: client?.name ?? null,
        clientUserRole: clientId ? clientUserRole : null,
      });
      setTimeout(() => setClientSaveState("idle"), 2500);
    } catch {
      setClientSaveState("error");
      setTimeout(() => setClientSaveState("idle"), 3000);
    }
  }, [userId, selectedClientId, clientUserRole, allClients, onSaved]);

  const handleSavePermissions = useCallback(async () => {
    setPermSaveState("saving");
    const permissionIds = [...selectedPermIds];
    try {
      const res = await fetch(`/api/admin/users/${userId}/permissions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissionIds }),
      });
      const json: UserPermissionsPatchResponse = await res.json();
      if (!json.success) throw new Error(json.error);
      setPermSaveState("saved");
      onSaved({ id: userId, permissionCount: permissionIds.length });
      setTimeout(() => setPermSaveState("idle"), 2500);
    } catch {
      setPermSaveState("error");
      setTimeout(() => setPermSaveState("idle"), 3000);
    }
  }, [userId, selectedPermIds, onSaved]);

  const applyPreset = useCallback(() => {
    const keys = ROLE_PRESETS[clientUserRole] ?? [];
    const ids = new Set(
      allPermissions.filter((p) => keys.includes(p.key)).map((p) => p.id)
    );
    setSelectedPermIds(ids);
  }, [clientUserRole, allPermissions]);

  const togglePerm = useCallback((permId: string) => {
    setSelectedPermIds((prev) => {
      const next = new Set(prev);
      if (next.has(permId)) next.delete(permId);
      else next.add(permId);
      return next;
    });
  }, []);

  const isClientUser = profileRole === "client_user";

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
            <div className="w-7 h-7 rounded-full bg-vitti-medium/15 border border-vitti-medium/20 flex items-center justify-center">
              <User size={11} className="text-vitti-light/50" />
            </div>
            <div>
              <p className="text-[11px] font-light text-white/70">Editar usuário</p>
              {detail && (
                <p className="text-[9px] font-light text-white/25">{detail.email ?? detail.id}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.04] transition-colors">
            <X size={13} className="text-white/30" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 px-5 py-4 space-y-6">
          {loading && (
            <div className="flex items-center gap-2 text-[11px] font-light text-white/30">
              <Loader2 size={12} className="animate-spin" />
              Carregando…
            </div>
          )}

          {fetchError && (
            <p className="text-[11px] font-light text-red-400/70">{fetchError}</p>
          )}

          {!loading && !fetchError && detail && (
            <>
              {/* ── Perfil ── */}
              <section className="space-y-3">
                <p className="text-[9px] text-white/[0.15] tracking-[0.2em] uppercase">Perfil</p>

                <div>
                  <label className="text-[9px] font-light text-white/30 block mb-1">Nome</label>
                  <input
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="Nome do usuário"
                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-[11px] font-light text-white/70 placeholder-white/20 focus:outline-none focus:border-vitti-medium/40 transition-colors"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-light text-white/30 block mb-1.5">Status</label>
                  <div className="flex gap-2">
                    {(["active", "inactive"] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setProfileStatus(s)}
                        className={`text-[9px] font-light px-3 py-1.5 rounded-full border transition-all ${
                          profileStatus === s
                            ? s === "active"
                              ? "border-emerald-400/30 text-emerald-400/70 bg-emerald-400/5"
                              : "border-red-400/25 text-red-400/60 bg-red-400/5"
                            : "border-white/[0.08] text-white/25 hover:border-white/20"
                        }`}
                      >
                        {s === "active" ? "Ativo" : "Inativo"}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[9px] font-light text-white/30 block mb-1.5">
                    Tipo de acesso
                  </label>
                  <div className="flex gap-2">
                    {(["client_user", "vitti_admin"] as const).map((r) => (
                      <button
                        key={r}
                        onClick={() => setProfileRole(r)}
                        className={`text-[9px] font-light px-3 py-1.5 rounded-full border transition-all ${
                          profileRole === r
                            ? "border-vitti-medium/40 text-vitti-light/70 bg-vitti-medium/10"
                            : "border-white/[0.08] text-white/25 hover:border-white/20"
                        }`}
                      >
                        {GLOBAL_ROLE_LABELS[r]}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[9px] font-light text-white/20 block mb-1">
                    Email (somente leitura)
                  </label>
                  <p className="text-[10px] font-light text-white/25 px-3 py-2 bg-white/[0.02] rounded-lg border border-white/[0.05]">
                    {detail.email ?? "—"}
                  </p>
                </div>

                <div className="flex justify-end">
                  <SaveButton state={profileSaveState} onClick={handleSaveProfile} label="Salvar perfil" />
                </div>
              </section>

              {/* ── Cliente e função (somente client_user) ── */}
              {isClientUser && (
                <section className="space-y-3 border-t border-white/[0.04] pt-5">
                  <p className="text-[9px] text-white/[0.15] tracking-[0.2em] uppercase">
                    Cliente e função
                  </p>

                  {/* Cliente */}
                  <div>
                    <label className="text-[9px] font-light text-white/30 block mb-1.5">
                      Cliente vinculado
                    </label>
                    <select
                      value={selectedClientId}
                      onChange={(e) => setSelectedClientId(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-[11px] font-light text-white/70 focus:outline-none focus:border-vitti-medium/40 transition-colors appearance-none"
                    >
                      <option value="">— sem vínculo —</option>
                      {allClients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                          {c.status !== "active" ? " (inativo)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Função — só visível com cliente selecionado */}
                  {selectedClientId && (
                    <div className="space-y-2">
                      <label className="text-[9px] font-light text-white/30 block">
                        Função no cliente
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {(["admin", "finance", "team", "custom"] as const).map((role) => (
                          <button
                            key={role}
                            onClick={() => setClientUserRole(role)}
                            className={`text-left px-3 py-2.5 rounded-lg border transition-all ${
                              clientUserRole === role
                                ? "border-vitti-medium/35 bg-vitti-medium/[0.08]"
                                : "border-white/[0.06] bg-white/[0.01] hover:border-white/[0.12]"
                            }`}
                          >
                            <p className={`text-[9px] font-light leading-snug ${
                              clientUserRole === role ? "text-vitti-light/80" : "text-white/40"
                            }`}>
                              {CLIENT_ROLE_LABELS[role]}
                            </p>
                            <p className="text-[8px] font-light text-white/20 mt-0.5">
                              {CLIENT_ROLE_DESCRIPTIONS[role]}
                            </p>
                          </button>
                        ))}
                      </div>

                      {clientUserRole !== "custom" && (
                        <button
                          onClick={applyPreset}
                          className="text-[9px] font-light px-3 py-1.5 rounded-full border border-vitti-medium/20 text-vitti-light/40 hover:border-vitti-medium/40 hover:text-vitti-light/70 transition-all"
                        >
                          Aplicar permissões da função
                        </button>
                      )}
                    </div>
                  )}

                  <div className="flex justify-end">
                    <SaveButton
                      state={clientSaveState}
                      onClick={handleSaveClient}
                      label="Salvar vínculo e função"
                    />
                  </div>
                </section>
              )}

              {/* ── Permissões (somente client_user) ── */}
              {isClientUser && (
                <section className="space-y-3 border-t border-white/[0.04] pt-5">
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] text-white/[0.15] tracking-[0.2em] uppercase">
                      Permissões
                    </p>
                    <span className="text-[9px] text-white/20 font-light">
                      {selectedPermIds.size} selecionada{selectedPermIds.size !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {allPermissions.length === 0 ? (
                    <p className="text-[10px] font-light text-white/20">
                      Nenhuma permissão cadastrada. Verifique o seed no banco.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {allPermissions.map((perm) => {
                        const checked = selectedPermIds.has(perm.id);
                        return (
                          <button
                            key={perm.id}
                            onClick={() => togglePerm(perm.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-all ${
                              checked
                                ? "border-vitti-medium/25 bg-vitti-medium/[0.06]"
                                : "border-white/[0.05] bg-white/[0.01] hover:border-white/[0.10]"
                            }`}
                          >
                            <div
                              className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all ${
                                checked
                                  ? "border-vitti-medium/60 bg-vitti-medium/30"
                                  : "border-white/[0.15]"
                              }`}
                            >
                              {checked && <div className="w-1.5 h-1.5 rounded-sm bg-vitti-light/70" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-light text-white/60">{perm.name}</p>
                              <p className="text-[8px] font-mono text-white/20">{perm.key}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex justify-end">
                    <SaveButton state={permSaveState} onClick={handleSavePermissions} label="Salvar permissões" />
                  </div>
                </section>
              )}

              {/* Nota para vitti_admin */}
              {!isClientUser && (
                <div className="rounded-lg border border-vitti-medium/10 bg-vitti-medium/[0.04] px-3 py-2.5">
                  <p className="text-[9px] font-light text-white/30 leading-relaxed">
                    Vitti Admin tem acesso irrestrito ao portal. Cliente vinculado e
                    permissões individuais não se aplicam.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────────

interface Props {
  initialUsers: AdminUserRow[];
  allPermissions: AdminPermission[];
  allClients: AdminClientRow[];
  permSeedWarning?: string;
}

export function UsersAdminPanel({ initialUsers, allPermissions, allClients, permSeedWarning }: Props) {
  const [users, setUsers] = useState<AdminUserRow[]>(initialUsers);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  const filtered = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    const matchQ =
      !q ||
      (u.name ?? "").toLowerCase().includes(q) ||
      (u.email ?? "").toLowerCase().includes(q);
    const matchS =
      statusFilter === "all" ||
      (statusFilter === "active" ? u.status === "active" : u.status !== "active");
    return matchQ && matchS;
  });

  const handleSaved = useCallback(
    (updated: Partial<AdminUserRow> & { id: string }) => {
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)));
    },
    []
  );

  return (
    <div className="space-y-4">
      {/* Aviso discreto quando ensureDefaultPermissions falhou */}
      {permSeedWarning && (
        <div className="rounded-xl border border-amber-400/15 bg-amber-400/[0.03] px-4 py-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={12} className="text-amber-400/50 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-[9px] font-light text-amber-400/60 leading-relaxed">
                <span className="text-amber-400/80">Permissões padrão</span> — {permSeedWarning}
              </p>
              <p className="text-[8px] font-light text-white/20">
                O painel continua funcional. Aplique o GRANT manualmente no banco se necessário.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Search + filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={11} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome ou email…"
            className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl pl-8 pr-3 py-2.5 text-[11px] font-light text-white/70 placeholder-white/20 focus:outline-none focus:border-vitti-medium/30 transition-colors"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X size={10} className="text-white/30 hover:text-white/60" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1">
          {(["all", "active", "inactive"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`text-[9px] font-light px-2.5 py-1.5 rounded-full border transition-all ${
                statusFilter === s
                  ? "border-vitti-medium/50 text-vitti-light/70 bg-vitti-medium/10"
                  : "border-white/[0.07] text-white/25 hover:border-white/15"
              }`}
            >
              {s === "all" ? "Todos" : s === "active" ? "Ativos" : "Inativos"}
            </button>
          ))}
        </div>

        <span className="text-[9px] font-light text-white/20 ml-auto">
          {filtered.length} de {users.length}
        </span>
      </div>

      {/* User list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12">
          <Users size={24} className="text-white/10" />
          <p className="text-[11px] font-light text-white/20">
            {searchQuery || statusFilter !== "all"
              ? "Nenhum usuário encontrado com esses filtros."
              : "Nenhum usuário cadastrado."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((u) => (
            <UserRow key={u.id} user={u} onEdit={setEditingUserId} />
          ))}
        </div>
      )}

      {/* Info: criação de usuários */}
      <div className="rounded-xl border border-white/[0.04] bg-white/[0.01] px-4 py-3">
        <div className="flex items-start gap-2.5">
          <ShieldCheck size={12} className="text-white/20 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="text-[9px] font-light text-white/30 leading-relaxed">
              <span className="text-white/50">Criação de novos usuários</span> — depende do
              Supabase Auth (profiles.auth_user_id NOT NULL). Ficará para sprint futura com
              fluxo de convite por email. Nesta sprint: editar perfis existentes, vincular
              clientes e gerenciar permissões.
            </p>
            <p className="text-[9px] font-light text-white/20 font-mono">
              Para criar: cadastrar via Supabase Auth → profile criado automaticamente → editar aqui.
            </p>
          </div>
        </div>
      </div>

      {/* Edit modal */}
      {editingUserId && (
        <EditModal
          userId={editingUserId}
          allPermissions={allPermissions}
          allClients={allClients}
          onClose={() => setEditingUserId(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

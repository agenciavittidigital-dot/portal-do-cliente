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
  UserPlus,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Loader2,
  AlertTriangle,
  Copy,
  Check,
} from "lucide-react";
import type { AdminUserRow, AdminUserDetail, AdminPermission } from "@/lib/data/users-admin";
import type { AdminClientRow } from "@/lib/data/clients-admin";
import type { UserDetailResponse, UserPatchResponse } from "@/app/api/admin/users/[id]/route";
import type { UserClientPatchResponse } from "@/app/api/admin/users/[id]/client/route";
import type { UserPermissionsPatchResponse } from "@/app/api/admin/users/[id]/permissions/route";
import type { UserCreateResponse } from "@/app/api/admin/users/route";
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
      className="inline-flex items-center gap-1.5 text-[10px] font-light text-[#5F6368]/60 hover:text-[#111111]/75 transition-colors"
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
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-black/[0.06] bg-black/[0.02] hover:border-black/[0.10] hover:bg-black/[0.03] transition-all group">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-vitti-medium/20 border border-vitti-medium/20 flex items-center justify-center shrink-0">
        <span className="text-[10px] font-light text-vitti-light/60">{ini}</span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[12px] font-light text-[#111111]/90 truncate">
            {user.name ?? "Sem nome"}
          </span>
          <span
            className={`text-[8px] font-light px-1.5 py-0.5 rounded border ${
              isAdmin
                ? "border-vitti-medium/30 text-vitti-light/60 bg-vitti-medium/10"
                : "border-black/[0.08] text-[#5F6368]/60 bg-black/[0.02]"
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
          <span className="text-[10px] font-light text-[#5F6368]/60 truncate">
            {user.email ?? "—"}
          </span>
          {user.clientName && (
            <span className="text-[9px] font-light text-vitti-light/40 shrink-0">
              {clientRoleLabel ? `${clientRoleLabel} · ` : ""}
              {user.clientName}
            </span>
          )}
          {user.permissionCount > 0 && (
            <span className="text-[9px] font-light text-[#5F6368]/50 shrink-0">
              {user.permissionCount} permiss{user.permissionCount === 1 ? "ão" : "ões"}
            </span>
          )}
        </div>
      </div>

      <button
        onClick={() => onEdit(user.id)}
        className="shrink-0 flex items-center gap-1 text-[9px] font-light text-[#5F6368]/50 hover:text-vitti-light/70 transition-colors px-2 py-1 rounded-lg hover:bg-black/[0.04]"
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

// ── Field ──────────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[9px] font-light text-[#5F6368]/60 block mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full bg-black/[0.03] border border-black/[0.08] rounded-lg px-3 py-2 text-[11px] font-light text-[#111111]/80 placeholder-[#5F6368]/40 focus:outline-none focus:border-vitti-medium/40 transition-colors disabled:opacity-50"
    />
  );
}

// ── CreateUserModal ────────────────────────────────────────────────────────────

function CreateUserModal({
  allClients,
  onClose,
  onCreated,
}: {
  allClients: AdminClientRow[];
  onClose: () => void;
  onCreated: (user: AdminUserRow) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [clientId, setClientId] = useState("");
  const [role, setRole] = useState<ClientRole>("team");
  const [status, setStatus] = useState<"active" | "inactive">("active");

  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [createdEmail, setCreatedEmail] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  const validate = (): string | null => {
    if (!name.trim()) return "Nome é obrigatório.";
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return "E-mail inválido.";
    if (!clientId) return "Selecione um cliente.";
    return null;
  };

  const handleSubmit = useCallback(async () => {
    const err = validate();
    if (err) { setFieldError(err); return; }
    setFieldError(null);
    setApiError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase(), clientId, role, status }),
      });
      const json = (await res.json()) as UserCreateResponse;

      if (!json.success) {
        setApiError(json.error ?? "Erro desconhecido.");
        return;
      }

      if (json.newUser) onCreated(json.newUser);
      setCreatedEmail(email.trim().toLowerCase());
      setTempPassword(json.tempPassword ?? null);
      setSuccess(true);
    } catch {
      setApiError("Erro de conexão.");
    } finally {
      setSubmitting(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, email, clientId, role, status, onCreated]);

  function copyPassword() {
    if (!tempPassword) return;
    navigator.clipboard.writeText(tempPassword).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={!success ? onClose : undefined}
      />

      <div className="relative w-full max-w-md h-full bg-[#0d1117] border-l border-black/[0.07] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-black/[0.07] bg-[#0d1117]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-emerald-400/10 border border-emerald-400/15 flex items-center justify-center">
              <UserPlus size={11} className="text-emerald-400/50" />
            </div>
            <p className="text-[11px] font-light text-[#111111]/80">Novo usuário cliente</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-black/[0.04] transition-colors"
          >
            <X size={13} className="text-[#5F6368]/60" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 px-5 py-5">
          {success ? (
            /* ── Painel de sucesso ── */
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-400/70" />
                <p className="text-sm font-light text-[#111111]/80">Usuário criado com sucesso</p>
              </div>

              {createdEmail && (
                <p className="text-[10px] font-light text-[#5F6368]/60">{createdEmail}</p>
              )}

              {tempPassword ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-amber-400/15 bg-amber-400/[0.03] px-4 py-3">
                    <p className="text-[9px] font-light text-amber-400/70 leading-relaxed">
                      <span className="text-amber-400/90">Senha temporária</span> — exibida
                      apenas uma vez. Informe o cliente e oriente-o a alterar após o primeiro
                      acesso.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 rounded-lg border border-black/[0.08] bg-black/[0.03] px-3 py-2.5">
                    <code className="flex-1 text-[13px] font-mono text-[#111111]/90 tracking-widest select-all">
                      {tempPassword}
                    </code>
                    <button
                      onClick={copyPassword}
                      className="shrink-0 p-1.5 rounded-md hover:bg-black/[0.06] transition-colors"
                    >
                      {copied ? (
                        <Check size={13} className="text-emerald-400/70" />
                      ) : (
                        <Copy size={13} className="text-[#5F6368]/60 hover:text-[#111111]/75" />
                      )}
                    </button>
                  </div>

                  <p className="text-[9px] font-light text-[#5F6368]/50">
                    Login: <span className="font-mono text-[#5F6368]/65">{createdEmail}</span>
                  </p>
                </div>
              ) : (
                <p className="text-[10px] font-light text-[#5F6368]/60">
                  O usuário já possuía cadastro — vínculo com o cliente criado com sucesso.
                </p>
              )}

              <button
                onClick={onClose}
                className="w-full text-[10px] font-light py-2.5 rounded-xl border border-black/[0.08] text-[#5F6368]/70 hover:text-[#111111]/85 hover:border-black/[0.15] transition-all mt-4"
              >
                Fechar
              </button>
            </div>
          ) : (
            /* ── Formulário de criação ── */
            <div className="space-y-5">
              <Field label="Nome">
                <TextInput
                  value={name}
                  onChange={setName}
                  placeholder="Nome completo"
                  disabled={submitting}
                />
              </Field>

              <Field label="E-mail">
                <TextInput
                  value={email}
                  onChange={setEmail}
                  placeholder="email@exemplo.com"
                  type="email"
                  disabled={submitting}
                />
              </Field>

              <Field label="Cliente">
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  disabled={submitting}
                  className="w-full bg-black/[0.03] border border-black/[0.08] rounded-lg px-3 py-2 text-[11px] font-light text-[#111111]/80 focus:outline-none focus:border-vitti-medium/40 transition-colors appearance-none disabled:opacity-50"
                >
                  <option value="">— selecione um cliente —</option>
                  {allClients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.status !== "active" ? " (inativo)" : ""}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Função no cliente">
                <div className="grid grid-cols-2 gap-1.5 mt-0.5">
                  {(["admin", "finance", "team", "custom"] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setRole(r)}
                      disabled={submitting}
                      className={`text-left px-3 py-2.5 rounded-lg border transition-all disabled:opacity-50 ${
                        role === r
                          ? "border-vitti-medium/35 bg-vitti-medium/[0.08]"
                          : "border-black/[0.07] bg-black/[0.02] hover:border-black/[0.10]"
                      }`}
                    >
                      <p
                        className={`text-[9px] font-light leading-snug ${
                          role === r ? "text-vitti-light/80" : "text-[#5F6368]/70"
                        }`}
                      >
                        {CLIENT_ROLE_LABELS[r]}
                      </p>
                      <p className="text-[8px] font-light text-[#5F6368]/50 mt-0.5">
                        {CLIENT_ROLE_DESCRIPTIONS[r]}
                      </p>
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Status">
                <div className="flex gap-2 mt-0.5">
                  {(["active", "inactive"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatus(s)}
                      disabled={submitting}
                      className={`text-[9px] font-light px-3 py-1.5 rounded-full border transition-all disabled:opacity-50 ${
                        status === s
                          ? s === "active"
                            ? "border-emerald-400/30 text-emerald-400/70 bg-emerald-400/5"
                            : "border-red-400/25 text-red-400/60 bg-red-400/5"
                          : "border-black/[0.08] text-[#5F6368]/55 hover:border-white/20"
                      }`}
                    >
                      {s === "active" ? "Ativo" : "Inativo"}
                    </button>
                  ))}
                </div>
              </Field>

              {/* Permissões do preset */}
              {role !== "custom" && ROLE_PRESETS[role].length > 0 && (
                <div className="rounded-lg border border-black/[0.06] bg-black/[0.02] px-3 py-2.5">
                  <p className="text-[9px] font-light text-[#5F6368]/55 mb-1.5">
                    Permissões aplicadas automaticamente ({CLIENT_ROLE_LABELS[role]}):
                  </p>
                  <p className="text-[8px] font-mono text-[#5F6368]/50 leading-relaxed">
                    {ROLE_PRESETS[role].join(", ")}
                  </p>
                </div>
              )}

              {/* Erros */}
              {(fieldError || apiError) && (
                <div className="rounded-lg border border-red-400/20 bg-red-400/[0.04] px-3 py-2.5">
                  <p className="text-[10px] font-light text-red-400/70">
                    {fieldError ?? apiError}
                  </p>
                </div>
              )}

              {/* Botão */}
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 text-[10px] font-light py-2.5 rounded-xl border border-vitti-medium/30 text-vitti-light/60 hover:border-vitti-medium/60 hover:text-vitti-light/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 size={11} className="animate-spin" />
                    Criando usuário…
                  </>
                ) : (
                  <>
                    <UserPlus size={11} />
                    Criar usuário
                  </>
                )}
              </button>

              <p className="text-[8px] font-light text-[#5F6368]/35 text-center leading-relaxed">
                Uma senha temporária será gerada. O cliente pode alterá-la após o primeiro acesso.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
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

      <div className="relative w-full max-w-md h-full bg-[#0d1117] border-l border-black/[0.07] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-black/[0.07] bg-[#0d1117]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-vitti-medium/15 border border-vitti-medium/20 flex items-center justify-center">
              <User size={11} className="text-vitti-light/50" />
            </div>
            <div>
              <p className="text-[11px] font-light text-[#111111]/80">Editar usuário</p>
              {detail && (
                <p className="text-[9px] font-light text-[#5F6368]/55">{detail.email ?? detail.id}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/[0.04] transition-colors">
            <X size={13} className="text-[#5F6368]/60" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 px-5 py-4 space-y-6">
          {loading && (
            <div className="flex items-center gap-2 text-[11px] font-light text-[#5F6368]/60">
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
                  <label className="text-[9px] font-light text-[#5F6368]/60 block mb-1">Nome</label>
                  <input
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="Nome do usuário"
                    className="w-full bg-black/[0.03] border border-black/[0.08] rounded-lg px-3 py-2 text-[11px] font-light text-[#111111]/80 placeholder-[#5F6368]/40 focus:outline-none focus:border-vitti-medium/40 transition-colors"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-light text-[#5F6368]/60 block mb-1.5">Status</label>
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
                            : "border-black/[0.08] text-[#5F6368]/55 hover:border-white/20"
                        }`}
                      >
                        {s === "active" ? "Ativo" : "Inativo"}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[9px] font-light text-[#5F6368]/60 block mb-1.5">
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
                            : "border-black/[0.08] text-[#5F6368]/55 hover:border-white/20"
                        }`}
                      >
                        {GLOBAL_ROLE_LABELS[r]}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[9px] font-light text-[#5F6368]/50 block mb-1">
                    Email (somente leitura)
                  </label>
                  <p className="text-[10px] font-light text-[#5F6368]/55 px-3 py-2 bg-black/[0.02] rounded-lg border border-black/[0.06]">
                    {detail.email ?? "—"}
                  </p>
                </div>

                <div className="flex justify-end">
                  <SaveButton state={profileSaveState} onClick={handleSaveProfile} label="Salvar perfil" />
                </div>
              </section>

              {/* ── Cliente e função (somente client_user) ── */}
              {isClientUser && (
                <section className="space-y-3 border-t border-black/[0.05] pt-5">
                  <p className="text-[9px] text-white/[0.15] tracking-[0.2em] uppercase">
                    Cliente e função
                  </p>

                  <div>
                    <label className="text-[9px] font-light text-[#5F6368]/60 block mb-1.5">
                      Cliente vinculado
                    </label>
                    <select
                      value={selectedClientId}
                      onChange={(e) => setSelectedClientId(e.target.value)}
                      className="w-full bg-black/[0.03] border border-black/[0.08] rounded-lg px-3 py-2 text-[11px] font-light text-[#111111]/80 focus:outline-none focus:border-vitti-medium/40 transition-colors appearance-none"
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

                  {selectedClientId && (
                    <div className="space-y-2">
                      <label className="text-[9px] font-light text-[#5F6368]/60 block">
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
                                : "border-black/[0.07] bg-black/[0.02] hover:border-black/[0.10]"
                            }`}
                          >
                            <p className={`text-[9px] font-light leading-snug ${
                              clientUserRole === role ? "text-vitti-light/80" : "text-[#5F6368]/70"
                            }`}>
                              {CLIENT_ROLE_LABELS[role]}
                            </p>
                            <p className="text-[8px] font-light text-[#5F6368]/50 mt-0.5">
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
                <section className="space-y-3 border-t border-black/[0.05] pt-5">
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] text-white/[0.15] tracking-[0.2em] uppercase">
                      Permissões
                    </p>
                    <span className="text-[9px] text-[#5F6368]/50 font-light">
                      {selectedPermIds.size} selecionada{selectedPermIds.size !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {allPermissions.length === 0 ? (
                    <p className="text-[10px] font-light text-[#5F6368]/50">
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
                                : "border-black/[0.06] bg-black/[0.02] hover:border-black/[0.10]"
                            }`}
                          >
                            <div
                              className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all ${
                                checked
                                  ? "border-vitti-medium/60 bg-vitti-medium/30"
                                  : "border-black/[0.15]"
                              }`}
                            >
                              {checked && <div className="w-1.5 h-1.5 rounded-sm bg-vitti-light/70" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-light text-[#111111]/70">{perm.name}</p>
                              <p className="text-[8px] font-mono text-[#5F6368]/50">{perm.key}</p>
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

              {!isClientUser && (
                <div className="rounded-lg border border-vitti-medium/10 bg-vitti-medium/[0.04] px-3 py-2.5">
                  <p className="text-[9px] font-light text-[#5F6368]/60 leading-relaxed">
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
  const [creatingUser, setCreatingUser] = useState(false);

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

  const handleCreated = useCallback((newUser: AdminUserRow) => {
    setUsers((prev) => [newUser, ...prev]);
  }, []);

  return (
    <div className="space-y-4">
      {/* Aviso de seed */}
      {permSeedWarning && (
        <div className="rounded-xl border border-amber-400/15 bg-amber-400/[0.03] px-4 py-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={12} className="text-amber-400/50 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-[9px] font-light text-amber-400/60 leading-relaxed">
                <span className="text-amber-400/80">Permissões padrão</span> — {permSeedWarning}
              </p>
              <p className="text-[8px] font-light text-[#5F6368]/50">
                O painel continua funcional. Aplique o GRANT manualmente no banco se necessário.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar: search + filter + Novo usuário */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={11} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5F6368]/50" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome ou email…"
            className="w-full bg-black/[0.03] border border-black/[0.07] rounded-xl pl-8 pr-3 py-2.5 text-[11px] font-light text-[#111111]/80 placeholder-[#5F6368]/40 focus:outline-none focus:border-vitti-medium/30 transition-colors"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X size={10} className="text-[#5F6368]/60 hover:text-[#111111]/75" />
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
                  : "border-black/[0.08] text-[#5F6368]/55 hover:border-white/15"
              }`}
            >
              {s === "all" ? "Todos" : s === "active" ? "Ativos" : "Inativos"}
            </button>
          ))}
        </div>

        <span className="text-[9px] font-light text-[#5F6368]/50">
          {filtered.length} de {users.length}
        </span>

        <button
          onClick={() => setCreatingUser(true)}
          className="flex items-center gap-1.5 text-[9px] font-light px-3 py-2 rounded-full border border-emerald-400/20 text-emerald-400/60 hover:border-emerald-400/40 hover:text-emerald-400/80 transition-all"
        >
          <UserPlus size={10} />
          Novo usuário
        </button>
      </div>

      {/* User list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12">
          <Users size={24} className="text-[#5F6368]/25" />
          <p className="text-[11px] font-light text-[#5F6368]/50">
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

      {/* Nota de segurança */}
      <div className="rounded-xl border border-black/[0.05] bg-black/[0.02] px-4 py-3">
        <div className="flex items-start gap-2.5">
          <ShieldCheck size={12} className="text-[#5F6368]/50 shrink-0 mt-0.5" />
          <p className="text-[9px] font-light text-[#5F6368]/55 leading-relaxed">
            Apenas usuários com <span className="text-[#5F6368]/70">global_role = client_user</span>{" "}
            podem ser criados por esta tela. Vitti Admins são configurados diretamente no banco.
          </p>
        </div>
      </div>

      {/* Modal de criação */}
      {creatingUser && (
        <CreateUserModal
          allClients={allClients}
          onClose={() => setCreatingUser(false)}
          onCreated={handleCreated}
        />
      )}

      {/* Modal de edição */}
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

import "server-only";
import { createAdminClient as mkAdmin } from "@/lib/supabase/admin";
import type { GlobalRole } from "@/types";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AdminUserRow {
  id: string;         // profiles.id
  authUserId: string; // profiles.auth_user_id → auth.users.id
  name: string | null;
  email: string | null;
  globalRole: GlobalRole;
  status: string;
  clientId: string | null;
  clientName: string | null;
  clientUserRole: string | null; // client_users.role
  permissionCount: number;
}

export interface AdminUserDetail {
  id: string;
  authUserId: string;
  name: string | null;
  email: string | null;
  globalRole: GlobalRole;
  status: string;
  client: { id: string; name: string } | null;
  clientUserRole: string | null; // client_users.role
  permissionIds: string[];
}

export interface AdminPermission {
  id: string;
  key: string;
  name: string;
  description: string | null;
  module: string;
}

// ── Permissões padrão ──────────────────────────────────────────────────────────

const DEFAULT_PERMISSIONS: Array<{
  key: string;
  name: string;
  description: string;
  module: string;
}> = [
  { key: "view_home",        name: "Ver Home",               description: "Permite acessar a página inicial do portal.",        module: "portal"    },
  { key: "view_metrics",     name: "Ver Dados e Métricas",   description: "Permite acessar dashboards e métricas do cliente.",  module: "metrics"   },
  { key: "view_reports",     name: "Ver Relatórios",         description: "Permite acessar relatórios do cliente.",             module: "reports"   },
  { key: "view_finance",     name: "Ver Financeiro",         description: "Permite acessar a área financeira do cliente.",      module: "finance"   },
  { key: "view_calls",       name: "Ver Calls",              description: "Permite acessar registros e links de calls.",        module: "calls"     },
  { key: "view_education",   name: "Ver Educação",           description: "Permite acessar conteúdos educacionais.",            module: "education" },
  { key: "admin_clients",    name: "Administrar Clientes",   description: "Permite gerenciar clientes no painel admin.",        module: "admin"     },
  { key: "admin_dashboards", name: "Administrar Dashboards", description: "Permite configurar dashboards, blocos e métricas.",  module: "admin"     },
  { key: "admin_users",      name: "Administrar Usuários",   description: "Permite gerenciar usuários, vínculos e permissões.", module: "admin"     },
];

// ── List ───────────────────────────────────────────────────────────────────────

export async function listAdminUsers(): Promise<AdminUserRow[]> {
  const admin = mkAdmin();

  const { data: profileRows, error } = await admin
    .from("profiles")
    .select("id, auth_user_id, name, email, global_role, status")
    .order("name");

  if (error) {
    console.error("[listAdminUsers] Erro ao carregar perfis:", error.message);
    return [];
  }

  if (!profileRows?.length) return [];

  const profileIds = profileRows.map((r) => String(r.id));

  // client_users usa profile_id (não user_id)
  const { data: clientUserRows } = await admin
    .from("client_users")
    .select("id, profile_id, client_id, role")
    .in("profile_id", profileIds);

  const clientUserIdByProfile = new Map<string, string>(); // profile_id → client_users.id
  const clientIdByProfile = new Map<string, string>();      // profile_id → client_id
  const clientRoleByProfile = new Map<string, string>();    // profile_id → role
  for (const r of clientUserRows ?? []) {
    clientUserIdByProfile.set(String(r.profile_id), String(r.id));
    clientIdByProfile.set(String(r.profile_id), String(r.client_id));
    clientRoleByProfile.set(String(r.profile_id), String(r.role ?? "team"));
  }

  // Contagem de permissões via client_user_id
  const clientUserIds = [...clientUserIdByProfile.values()];
  const permCountByClientUserId = new Map<string, number>();
  if (clientUserIds.length > 0) {
    const { data: permRows } = await admin
      .from("user_permissions")
      .select("client_user_id")
      .in("client_user_id", clientUserIds);
    for (const r of permRows ?? []) {
      const cuid = String(r.client_user_id);
      permCountByClientUserId.set(cuid, (permCountByClientUserId.get(cuid) ?? 0) + 1);
    }
  }

  // Nomes dos clientes vinculados
  const clientIds = [...new Set([...clientIdByProfile.values()])];
  const clientNameById = new Map<string, string>();
  if (clientIds.length > 0) {
    const { data: clientRows } = await admin
      .from("clients")
      .select("id, name")
      .in("id", clientIds);
    for (const c of clientRows ?? []) {
      clientNameById.set(String(c.id), String(c.name ?? ""));
    }
  }

  return profileRows.map((r) => {
    const pid = String(r.id);
    const clientUserId = clientUserIdByProfile.get(pid);
    const clientId = clientIdByProfile.get(pid) ?? null;
    return {
      id: pid,
      authUserId: String(r.auth_user_id ?? ""),
      name: r.name ? String(r.name) : null,
      email: r.email ? String(r.email) : null,
      globalRole: r.global_role === "vitti_admin" ? "vitti_admin" : "client_user",
      status: String(r.status ?? ""),
      clientId,
      clientName: clientId ? (clientNameById.get(clientId) ?? null) : null,
      clientUserRole: clientId ? (clientRoleByProfile.get(pid) ?? "team") : null,
      permissionCount: clientUserId ? (permCountByClientUserId.get(clientUserId) ?? 0) : 0,
    };
  });
}

// ── Detail (para edição) ───────────────────────────────────────────────────────

export async function getAdminUserDetail(
  profileId: string
): Promise<AdminUserDetail | null> {
  const admin = mkAdmin();

  const { data: profile, error } = await admin
    .from("profiles")
    .select("id, auth_user_id, name, email, global_role, status")
    .eq("id", profileId)
    .maybeSingle();

  if (error || !profile) return null;

  // client_users usa profile_id
  const { data: clientUserRow } = await admin
    .from("client_users")
    .select("id, client_id, role")
    .eq("profile_id", profileId)
    .maybeSingle();

  // Permissões via client_users.id → user_permissions.client_user_id
  let permissionIds: string[] = [];
  if (clientUserRow?.id) {
    const { data: permRows } = await admin
      .from("user_permissions")
      .select("permission_id")
      .eq("client_user_id", String(clientUserRow.id));
    permissionIds = (permRows ?? [])
      .map((r) => String(r.permission_id))
      .filter(Boolean);
  }

  let client: { id: string; name: string } | null = null;
  if (clientUserRow?.client_id) {
    const { data: clientRow } = await admin
      .from("clients")
      .select("id, name")
      .eq("id", String(clientUserRow.client_id))
      .maybeSingle();
    if (clientRow) {
      client = { id: String(clientRow.id), name: String(clientRow.name ?? "") };
    }
  }

  return {
    id: String(profile.id),
    authUserId: String(profile.auth_user_id ?? ""),
    name: profile.name ? String(profile.name) : null,
    email: profile.email ? String(profile.email) : null,
    globalRole: profile.global_role === "vitti_admin" ? "vitti_admin" : "client_user",
    status: String(profile.status ?? ""),
    client,
    clientUserRole: clientUserRow?.role ? String(clientUserRow.role) : null,
    permissionIds,
  };
}

// ── Update profile ─────────────────────────────────────────────────────────────

export async function updateAdminUserProfile(
  profileId: string,
  patch: {
    name?: string | null;
    status?: "active" | "inactive";
    globalRole?: GlobalRole;
  }
): Promise<void> {
  const admin = mkAdmin();
  const update: Record<string, unknown> = {};

  if ("name" in patch) update.name = patch.name;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.globalRole !== undefined) update.global_role = patch.globalRole;

  if (Object.keys(update).length === 0) return;

  const { error } = await admin.from("profiles").update(update).eq("id", profileId);
  if (error) throw new Error(error.message);
}

// ── Set client link ────────────────────────────────────────────────────────────

export async function setUserClient(
  profileId: string,
  clientId: string | null,
  role?: string
): Promise<void> {
  const admin = mkAdmin();

  // client_users usa profile_id
  const { data: existing } = await admin
    .from("client_users")
    .select("id")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (clientId === null) {
    if (existing) {
      // Limpar permissões vinculadas antes de remover o vínculo
      await admin
        .from("user_permissions")
        .delete()
        .eq("client_user_id", String(existing.id));

      const { error } = await admin
        .from("client_users")
        .delete()
        .eq("profile_id", profileId);
      if (error) throw new Error(error.message);
    }
    return;
  }

  if (existing) {
    const updateData: Record<string, unknown> = { client_id: clientId };
    if (role !== undefined) updateData.role = role;

    const { error } = await admin
      .from("client_users")
      .update(updateData)
      .eq("profile_id", profileId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await admin
      .from("client_users")
      .insert({ profile_id: profileId, client_id: clientId, role: role ?? "team" });
    if (error) throw new Error(error.message);
  }
}

// ── Set permissions (replace all) ─────────────────────────────────────────────

export async function setUserPermissions(
  profileId: string,
  permissionIds: string[]
): Promise<void> {
  const admin = mkAdmin();

  // user_permissions usa client_user_id → precisa do client_users.id
  const { data: clientUserRow } = await admin
    .from("client_users")
    .select("id")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (!clientUserRow?.id) {
    throw new Error(
      "Usuário não possui vínculo com cliente. Vincule um cliente antes de definir permissões."
    );
  }

  const clientUserId = String(clientUserRow.id);

  const { error: deleteErr } = await admin
    .from("user_permissions")
    .delete()
    .eq("client_user_id", clientUserId);
  if (deleteErr) throw new Error(deleteErr.message);

  if (permissionIds.length > 0) {
    const { error: insertErr } = await admin
      .from("user_permissions")
      .insert(
        permissionIds.map((pid) => ({ client_user_id: clientUserId, permission_id: pid }))
      );
    if (insertErr) throw new Error(insertErr.message);
  }
}

// ── Permissions catalog ────────────────────────────────────────────────────────

export async function listPermissions(): Promise<AdminPermission[]> {
  const admin = mkAdmin();
  const { data, error } = await admin
    .from("permissions")
    .select("id, key, name, description, module")
    .order("name");
  if (error) {
    console.error("[listPermissions] Erro:", error.message);
    return [];
  }
  return (data ?? []).map((r) => ({
    id: String(r.id),
    key: String(r.key ?? ""),
    name: String(r.name ?? ""),
    description: r.description ? String(r.description) : null,
    module: String(r.module ?? ""),
  }));
}

// ── Garantir permissões padrão ─────────────────────────────────────────────────

export async function ensureDefaultPermissions(): Promise<{
  success: boolean;
  created: string[];
  existing: string[];
  errorMessage?: string;
}> {
  const admin = mkAdmin();

  // Idempotência por key (campo único e NOT NULL)
  const { data: existingRows, error } = await admin
    .from("permissions")
    .select("key")
    .in("key", DEFAULT_PERMISSIONS.map((p) => p.key));

  if (error) {
    console.error("[ensureDefaultPermissions] Erro ao verificar permissões:", error.message);
    return {
      success: false,
      created: [],
      existing: [],
      errorMessage: "Erro ao verificar permissões padrão.",
    };
  }

  const existingKeys = new Set((existingRows ?? []).map((r) => String(r.key)));
  const toInsert = DEFAULT_PERMISSIONS.filter((p) => !existingKeys.has(p.key));

  if (toInsert.length > 0) {
    const { error: insertErr } = await admin.from("permissions").insert(toInsert);
    if (insertErr) {
      console.error("[ensureDefaultPermissions] Erro ao inserir:", insertErr.message);
      return {
        success: false,
        created: [],
        existing: [...existingKeys],
        errorMessage:
          "Permissões padrão não puderam ser criadas automaticamente. Verifique as grants do banco.",
      };
    }
  }

  return {
    success: true,
    created: toInsert.map((p) => p.key),
    existing: [...existingKeys],
  };
}

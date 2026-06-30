import "server-only";
import { createAdminClient as mkAdmin } from "@/lib/supabase/admin";
import type { GlobalRole } from "@/types";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AdminClientLink {
  clientUserId: string;
  clientId: string;
  clientName: string;
  role: string;
}

export interface AdminUserRow {
  id: string;         // profiles.id
  authUserId: string; // profiles.auth_user_id → auth.users.id
  name: string | null;
  email: string | null;
  globalRole: GlobalRole;
  status: string;
  clientId: string | null;       // primary (first) portal
  clientName: string | null;     // primary (first) portal name
  clientUserRole: string | null; // primary portal role
  permissionCount: number;
  portalCount: number;           // total linked portals
}

export interface AdminUserDetail {
  id: string;
  authUserId: string;
  name: string | null;
  email: string | null;
  globalRole: GlobalRole;
  status: string;
  clients: AdminClientLink[];    // all linked portals (replaces single `client`)
  clientUserRole: string | null; // role of first portal
  permissionIds: string[];       // permissions of the first portal
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

  // client_users usa profile_id (não user_id); order garante determinismo do portal primário
  const { data: clientUserRows } = await admin
    .from("client_users")
    .select("id, profile_id, client_id, role")
    .in("profile_id", profileIds)
    .order("created_at", { ascending: true });

  // first-wins: para cada profile, armazena apenas o primeiro vínculo para exibição na tabela
  const firstClientUserIdByProfile = new Map<string, string>();
  const firstClientIdByProfile = new Map<string, string>();
  const firstClientRoleByProfile = new Map<string, string>();
  const portalCountByProfile = new Map<string, number>();
  for (const r of clientUserRows ?? []) {
    const pid = String(r.profile_id);
    portalCountByProfile.set(pid, (portalCountByProfile.get(pid) ?? 0) + 1);
    if (!firstClientIdByProfile.has(pid)) {
      firstClientUserIdByProfile.set(pid, String(r.id));
      firstClientIdByProfile.set(pid, String(r.client_id));
      firstClientRoleByProfile.set(pid, String(r.role ?? "team"));
    }
  }

  // Contagem de permissões via client_user_id (apenas do portal primário)
  const clientUserIds = [...firstClientUserIdByProfile.values()];
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

  // Nomes dos clientes vinculados (apenas do portal primário de cada perfil)
  const clientIds = [...new Set([...firstClientIdByProfile.values()])];
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
    const clientUserId = firstClientUserIdByProfile.get(pid);
    const clientId = firstClientIdByProfile.get(pid) ?? null;
    return {
      id: pid,
      authUserId: String(r.auth_user_id ?? ""),
      name: r.name ? String(r.name) : null,
      email: r.email ? String(r.email) : null,
      globalRole: r.global_role === "vitti_admin" ? "vitti_admin" : "client_user",
      status: String(r.status ?? ""),
      clientId,
      clientName: clientId ? (clientNameById.get(clientId) ?? null) : null,
      clientUserRole: clientId ? (firstClientRoleByProfile.get(pid) ?? "team") : null,
      permissionCount: clientUserId ? (permCountByClientUserId.get(clientUserId) ?? 0) : 0,
      portalCount: portalCountByProfile.get(pid) ?? 0,
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

  // Busca TODOS os vínculos do perfil, ordenados por criação (primeiro = portal primário)
  const { data: allClientUserRows } = await admin
    .from("client_users")
    .select("id, client_id, role")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: true });

  const firstClientUserRow = allClientUserRows?.[0] ?? null;

  // Permissões do portal primário
  let permissionIds: string[] = [];
  if (firstClientUserRow?.id) {
    const { data: permRows } = await admin
      .from("user_permissions")
      .select("permission_id")
      .eq("client_user_id", String(firstClientUserRow.id));
    permissionIds = (permRows ?? [])
      .map((r) => String(r.permission_id))
      .filter(Boolean);
  }

  // Nomes de todos os clientes vinculados
  const allClientIds = [...new Set((allClientUserRows ?? []).map((r) => String(r.client_id)))];
  const clientNameById = new Map<string, string>();
  if (allClientIds.length > 0) {
    const { data: clientRows } = await admin
      .from("clients")
      .select("id, name")
      .in("id", allClientIds);
    for (const c of clientRows ?? []) {
      clientNameById.set(String(c.id), String(c.name ?? ""));
    }
  }

  const clients: AdminClientLink[] = (allClientUserRows ?? []).map((r) => ({
    clientUserId: String(r.id),
    clientId: String(r.client_id),
    clientName: clientNameById.get(String(r.client_id)) ?? "",
    role: String(r.role ?? "team"),
  }));

  return {
    id: String(profile.id),
    authUserId: String(profile.auth_user_id ?? ""),
    name: profile.name ? String(profile.name) : null,
    email: profile.email ? String(profile.email) : null,
    globalRole: profile.global_role === "vitti_admin" ? "vitti_admin" : "client_user",
    status: String(profile.status ?? ""),
    clients,
    clientUserRole: firstClientUserRow?.role ? String(firstClientUserRow.role) : null,
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

// ── Set permissions (replace all for a specific client link) ──────────────────

/**
 * Replaces all permissions for a specific client_users row.
 * clientUserId is the client_users.id (not profile.id).
 */
export async function setUserPermissions(
  clientUserId: string,
  permissionIds: string[]
): Promise<void> {
  const admin = mkAdmin();

  if (!clientUserId) {
    throw new Error("clientUserId é obrigatório para definir permissões.");
  }

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

// ── Ensure default permissions for a client link ──────────────────────────────

/**
 * Idempotent: creates all non-admin permissions for a client_users.id
 * only when that link has zero user_permissions rows. Safe to call repeatedly.
 */
export async function ensureClientUserPermissions(clientUserId: string): Promise<void> {
  const admin = mkAdmin();

  const { data: existing } = await admin
    .from("user_permissions")
    .select("id")
    .eq("client_user_id", clientUserId)
    .limit(1);

  if (existing && existing.length > 0) return;

  const { data: permRows } = await admin
    .from("permissions")
    .select("id")
    .not("module", "eq", "admin");

  const permIds = (permRows ?? []).map((r) => String(r.id)).filter(Boolean);
  if (permIds.length === 0) return;

  await admin
    .from("user_permissions")
    .insert(permIds.map((pid) => ({ client_user_id: clientUserId, permission_id: pid })));
}

// ── Add / remove individual client links (multi-client support) ───────────────

/**
 * Adds a new client link for a profile without removing existing ones.
 * Creates default permissions for the new link automatically.
 * No-op if the link already exists.
 */
export async function addUserClient(
  profileId: string,
  clientId: string,
  role: string = "team"
): Promise<void> {
  const admin = mkAdmin();

  const { data: existing } = await admin
    .from("client_users")
    .select("id")
    .eq("profile_id", profileId)
    .eq("client_id", clientId)
    .maybeSingle();

  if (existing) return;

  const { data: newRow, error } = await admin
    .from("client_users")
    .insert({ profile_id: profileId, client_id: clientId, role })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  if (newRow?.id) {
    try {
      await ensureClientUserPermissions(String(newRow.id));
    } catch (e) {
      console.error("[addUserClient] Falha ao criar permissões padrão:", e);
    }
  }
}

/**
 * Removes a specific client link for a profile, including its permissions.
 * No-op if the link does not exist.
 */
export async function removeUserClient(
  profileId: string,
  clientId: string
): Promise<void> {
  const admin = mkAdmin();

  const { data: existing } = await admin
    .from("client_users")
    .select("id")
    .eq("profile_id", profileId)
    .eq("client_id", clientId)
    .maybeSingle();

  if (!existing) return;

  await admin
    .from("user_permissions")
    .delete()
    .eq("client_user_id", String(existing.id));

  const { error } = await admin
    .from("client_users")
    .delete()
    .eq("profile_id", profileId)
    .eq("client_id", clientId);
  if (error) throw new Error(error.message);
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

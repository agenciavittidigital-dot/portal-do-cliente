import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile, Client, GlobalRole } from "@/types";

export type UserContextError =
  | "profile_not_found"
  | "user_inactive"
  | "load_error"
  | null;

export interface UserContext {
  userId: string;
  profile: Profile | null;
  client: Client | null;
  permissions: string[];
  isAdmin: boolean;
  error: UserContextError;
}

function coerceProfile(raw: Record<string, unknown>): Profile {
  const globalRole: GlobalRole =
    raw.global_role === "vitti_admin" ? "vitti_admin" : "client_user";
  return {
    id: String(raw.id ?? ""),
    auth_user_id: String(raw.auth_user_id ?? ""),
    name: raw.name ? String(raw.name) : null,
    email: raw.email ? String(raw.email) : null,
    global_role: globalRole,
    status: String(raw.status ?? ""),
  };
}

function coerceClient(raw: Record<string, unknown>): Client {
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    slug: String(raw.slug ?? ""),
    logo_url: raw.logo_url ? String(raw.logo_url) : null,
    active: raw.active === true,
  };
}

/**
 * Carrega o contexto completo do usuário autenticado usando o admin client
 * (service role key), que bypassa RLS e garante leitura consistente dos dados.
 *
 * O userId já foi validado via supabase.auth.getUser() no portal layout —
 * aqui apenas lemos dados associados a esse userId.
 */
export async function loadUserContext(userId: string): Promise<UserContext> {
  const base: UserContext = {
    userId,
    profile: null,
    client: null,
    permissions: [],
    isAdmin: false,
    error: null,
  };

  try {
    const admin = createAdminClient();

    // ── 1. Profile via auth_user_id ─────────────────────────────────
    const { data: profileRaw, error: profileError } = await admin
      .from("profiles")
      .select("id, auth_user_id, name, email, global_role, status")
      .eq("auth_user_id", userId)
      .maybeSingle();

    if (profileError || !profileRaw) {
      return { ...base, error: "profile_not_found" };
    }

    const profile = coerceProfile(profileRaw as Record<string, unknown>);

    // ── 2. Validação de status ──────────────────────────────────────
    if (profile.status !== "active") {
      return { ...base, profile, error: "user_inactive" };
    }

    const isAdmin = profile.global_role === "vitti_admin";

    // ── 3. Admin não precisa de client_users nem de permissões ─────
    if (isAdmin) {
      return { ...base, profile, isAdmin: true };
    }

    // ── 4. Cliente vinculado via profile.id ─────────────────────────
    let client: Client | null = null;

    const { data: clientUserRow } = await admin
      .from("client_users")
      .select("client_id")
      .eq("user_id", profile.id)
      .maybeSingle();

    if (clientUserRow?.client_id) {
      const { data: clientRaw } = await admin
        .from("clients")
        .select("id, name, slug, logo_url, active")
        .eq("id", clientUserRow.client_id)
        .maybeSingle();

      if (clientRaw) {
        client = coerceClient(clientRaw as Record<string, unknown>);
      }
    }

    // ── 5. Permissões via profile.id ────────────────────────────────
    let permissions: string[] = [];

    const { data: userPermRows } = await admin
      .from("user_permissions")
      .select("permission_id")
      .eq("user_id", profile.id);

    const permIds = (userPermRows ?? [])
      .map((r: Record<string, unknown>) => r.permission_id)
      .filter(Boolean) as string[];

    if (permIds.length > 0) {
      const { data: permRows } = await admin
        .from("permissions")
        .select("name")
        .in("id", permIds);

      permissions = (permRows ?? [])
        .map((r: Record<string, unknown>) => String(r.name ?? ""))
        .filter(Boolean);
    }

    return { ...base, profile, client, permissions, isAdmin: false };
  } catch (err) {
    console.error("[loadUserContext] Erro ao carregar contexto:", err);
    return { ...base, error: "load_error" };
  }
}

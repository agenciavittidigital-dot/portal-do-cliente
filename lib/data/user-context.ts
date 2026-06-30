import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile, Client, GlobalRole } from "@/types";

// ── Types ──────────────────────────────────────────────────────────────────────

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
  clientCount: number;
  error: UserContextError;
}

export interface UserClientOption {
  clientUserId: string;
  clientId: string;
  clientName: string;
  clientSlug: string;
  clientSegment: string | null;
  clientStatus: string;
  role: string;
}

// ── Coercers ───────────────────────────────────────────────────────────────────

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
    segment: raw.segment ? String(raw.segment) : null,
    status: String(raw.status ?? ""),
    logo_url: raw.logo_url ? String(raw.logo_url) : null,
  };
}

// ── listUserClients ────────────────────────────────────────────────────────────

/**
 * Returns all client portals accessible to a given auth user.
 * Returns null for vitti_admin users (they don't need portal selection).
 * Returns [] for client_users with no client links.
 */
export async function listUserClients(
  authUserId: string
): Promise<UserClientOption[] | null> {
  const admin = createAdminClient();

  const { data: profileRaw } = await admin
    .from("profiles")
    .select("id, global_role, status")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (!profileRaw) return [];
  if (profileRaw.status !== "active") return [];
  if (profileRaw.global_role === "vitti_admin") return null;

  const profileId = String(profileRaw.id);

  const { data: clientUserRows } = await admin
    .from("client_users")
    .select("id, client_id, role")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: true });

  if (!clientUserRows?.length) return [];

  const clientIds = clientUserRows.map((r) => String(r.client_id));

  const { data: clientRows } = await admin
    .from("clients")
    .select("id, name, slug, segment, status")
    .in("id", clientIds);

  const clientMap = new Map(
    (clientRows ?? []).map((c) => [String(c.id), c])
  );

  return clientUserRows
    .filter((r) => clientMap.has(String(r.client_id)))
    .map((r) => {
      const c = clientMap.get(String(r.client_id))!;
      return {
        clientUserId: String(r.id),
        clientId: String(r.client_id),
        clientName: String(c.name ?? ""),
        clientSlug: String(c.slug ?? ""),
        clientSegment: c.segment ? String(c.segment) : null,
        clientStatus: String(c.status ?? ""),
        role: String(r.role ?? "team"),
      };
    });
}

// ── loadUserContext ────────────────────────────────────────────────────────────

/**
 * Loads the full user context.
 *
 * When selectedClientId is provided, uses that specific client link.
 * When not provided, falls back to the first link found (backward-compat for
 * single-client users). clientCount always reflects the total number of links
 * so the portal layout can decide whether to show the portal selector.
 */
export async function loadUserContext(
  userId: string,
  selectedClientId?: string
): Promise<UserContext> {
  const base: UserContext = {
    userId,
    profile: null,
    client: null,
    permissions: [],
    isAdmin: false,
    clientCount: 0,
    error: null,
  };

  try {
    const admin = createAdminClient();

    // 1. Profile via auth_user_id
    const { data: profileRaw, error: profileError } = await admin
      .from("profiles")
      .select("id, auth_user_id, name, email, global_role, status")
      .eq("auth_user_id", userId)
      .maybeSingle();

    if (profileError || !profileRaw) {
      return { ...base, error: "profile_not_found" };
    }

    const profile = coerceProfile(profileRaw as Record<string, unknown>);

    // 2. Status check
    if (profile.status !== "active") {
      return { ...base, profile, error: "user_inactive" };
    }

    const isAdmin = profile.global_role === "vitti_admin";

    // 3. Admin bypasses client_users
    if (isAdmin) {
      return { ...base, profile, isAdmin: true };
    }

    // 4. Fetch ALL client links for this profile (ordered for determinism)
    const { data: clientUserRows } = await admin
      .from("client_users")
      .select("id, client_id")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: true });

    const allClientUsers = clientUserRows ?? [];
    const clientCount = allClientUsers.length;

    // Pick target: use selectedClientId if provided and valid; else first record
    let targetClientUser: { id: unknown; client_id: unknown } | null = null;

    if (selectedClientId) {
      targetClientUser =
        allClientUsers.find(
          (r) => String(r.client_id) === selectedClientId
        ) ?? null;
    }
    if (!targetClientUser && allClientUsers.length > 0) {
      targetClientUser = allClientUsers[0];
    }

    // 5. Fetch the client record
    let client: Client | null = null;

    if (targetClientUser?.client_id) {
      const { data: clientRaw } = await admin
        .from("clients")
        .select("id, name, slug, segment, status, logo_url")
        .eq("id", String(targetClientUser.client_id))
        .maybeSingle();

      if (clientRaw) {
        client = coerceClient(clientRaw as Record<string, unknown>);
      }
    }

    // 6. Permissions via client_users.id → user_permissions.client_user_id
    let permissions: string[] = [];
    const clientUserId = targetClientUser?.id ? String(targetClientUser.id) : null;

    if (clientUserId) {
      const { data: userPermRows } = await admin
        .from("user_permissions")
        .select("permission_id")
        .eq("client_user_id", clientUserId);

      const permIds = (userPermRows ?? [])
        .map((r: Record<string, unknown>) => r.permission_id)
        .filter(Boolean) as string[];

      if (permIds.length > 0) {
        const { data: permRows } = await admin
          .from("permissions")
          .select("key")
          .in("id", permIds);

        permissions = (permRows ?? [])
          .map((r: Record<string, unknown>) => String(r.key ?? ""))
          .filter(Boolean);
      }
    }

    return { ...base, profile, client, permissions, isAdmin: false, clientCount };
  } catch (err) {
    console.error("[loadUserContext] Erro ao carregar contexto:", err);
    return { ...base, error: "load_error" };
  }
}

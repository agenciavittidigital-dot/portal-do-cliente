import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface NotificationRecipient {
  id: string;
  name: string | null;
  email: string;
  type: "client_user" | "vitti_admin";
}

/**
 * Single source of truth for notification recipient eligibility.
 *
 * Returns:
 *   null                    → content not found
 *   NotificationRecipient[] → eligible recipients (may be empty [])
 *
 * Throws on any DB query failure — callers must treat as server error (500).
 */
export async function getEligibleNotificationRecipients(
  contentId: string
): Promise<NotificationRecipient[] | null> {
  const admin = createAdminClient();

  // 1. Resolve client_id from editorial_contents
  const { data: content, error: contentError } = await admin
    .from("editorial_contents")
    .select("client_id")
    .eq("id", contentId)
    .maybeSingle();

  if (contentError) {
    throw new Error("[editorial-recipients] Falha ao buscar editorial_contents.");
  }
  if (!content?.client_id) return null; // content does not exist

  const clientId = String(content.client_id);

  // 2. Fetch active client_users for this client
  const { data: clientUserRows, error: cuError } = await admin
    .from("client_users")
    .select("profile_id")
    .eq("client_id", clientId)
    .eq("status", "active");

  if (cuError) {
    throw new Error("[editorial-recipients] Falha ao buscar client_users.");
  }

  // 3. Fetch eligible client_user profiles
  let clientUserRecipients: NotificationRecipient[] = [];

  if (clientUserRows?.length) {
    const profileIds = clientUserRows.map((r) => String(r.profile_id));

    const { data: clientProfiles, error: cpError } = await admin
      .from("profiles")
      .select("id, name, email")
      .in("id", profileIds)
      .eq("status", "active")
      .eq("global_role", "client_user")
      .not("email", "is", null);

    if (cpError) {
      throw new Error("[editorial-recipients] Falha ao buscar profiles de client_users.");
    }

    clientUserRecipients = (clientProfiles ?? []).map((p) => ({
      id: String(p.id),
      name: p.name ?? null,
      email: p.email as string,
      type: "client_user" as const,
    }));
  }

  // 4. Fetch active vitti_admin profiles
  const { data: adminProfiles, error: adminError } = await admin
    .from("profiles")
    .select("id, name, email")
    .eq("global_role", "vitti_admin")
    .eq("status", "active")
    .not("email", "is", null);

  if (adminError) {
    throw new Error("[editorial-recipients] Falha ao buscar vitti_admin.");
  }

  const adminRecipients: NotificationRecipient[] = (adminProfiles ?? []).map((p) => ({
    id: String(p.id),
    name: p.name ?? null,
    email: p.email as string,
    type: "vitti_admin" as const,
  }));

  // 5. Merge and deduplicate by email (case-insensitive)
  const all = [...clientUserRecipients, ...adminRecipients];
  const seen = new Set<string>();

  return all.filter((r) => {
    const key = r.email.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

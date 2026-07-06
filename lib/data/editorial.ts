import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EditorialCategory {
  id: string;
  name: string;
  color: string;
  iconName: string;
  position: number;
}

export interface EditorialStatus {
  id: string;
  name: string;
  color: string;
  position: number;
}

export interface EditorialContent {
  id: string;
  clientId: string;
  clientName: string;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  statusId: string | null;
  statusName: string | null;
  statusColor: string | null;
  title: string;
  description: string | null;
  caption: string | null;
  scheduledAt: string | null;
  deliveryAt: string | null;
  responsibleId: string | null;
  videoUrl: string | null;
  attachmentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface EditorialResponsible {
  id: string;
  name: string;
}

// ── Queries ───────────────────────────────────────────────────────────────────

export async function listEditorialCategories(): Promise<EditorialCategory[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("editorial_categories")
    .select("id, name, color, icon_name, position")
    .order("position");
  if (error) console.error("[editorial] listCategories:", error.message);
  return (data ?? []).map((r) => ({
    id: String(r.id),
    name: String(r.name),
    color: String(r.color),
    iconName: String(r.icon_name),
    position: Number(r.position),
  }));
}

export async function listEditorialStatuses(): Promise<EditorialStatus[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("editorial_statuses")
    .select("id, name, color, position")
    .order("position");
  if (error) console.error("[editorial] listStatuses:", error.message);
  return (data ?? []).map((r) => ({
    id: String(r.id),
    name: String(r.name),
    color: String(r.color),
    position: Number(r.position),
  }));
}

export async function listEditorialContents(opts?: {
  clientId?: string;
}): Promise<EditorialContent[]> {
  const admin = createAdminClient();

  let contentsQuery = admin
    .from("editorial_contents")
    .select(
      "id, client_id, category_id, status_id, title, description, caption, scheduled_at, delivery_at, responsible_id, video_url, created_at, updated_at"
    )
    .order("scheduled_at", { ascending: true })
    .order("created_at", { ascending: true });

  if (opts?.clientId) {
    contentsQuery = contentsQuery.eq("client_id", opts.clientId);
  }

  const [
    { data: contentsRaw },
    { data: categoriesRaw },
    { data: statusesRaw },
    { data: clientsRaw },
    { data: attachmentsRaw },
  ] = await Promise.all([
    contentsQuery,
    admin
      .from("editorial_categories")
      .select("id, name, color"),
    admin
      .from("editorial_statuses")
      .select("id, name, color"),
    admin.from("clients").select("id, name"),
    admin.from("editorial_attachments").select("content_id"),
  ]);

  const attachCountMap = new Map<string, number>();
  for (const a of attachmentsRaw ?? []) {
    const key = String(a.content_id);
    attachCountMap.set(key, (attachCountMap.get(key) ?? 0) + 1);
  }

  const catMap = new Map(
    (categoriesRaw ?? []).map((c) => [String(c.id), c])
  );
  const stMap = new Map(
    (statusesRaw ?? []).map((s) => [String(s.id), s])
  );
  const clMap = new Map(
    (clientsRaw ?? []).map((c) => [String(c.id), c])
  );

  return (contentsRaw ?? []).map((r) => {
    const cat = r.category_id ? catMap.get(String(r.category_id)) : null;
    const st = r.status_id ? stMap.get(String(r.status_id)) : null;
    const cl = r.client_id ? clMap.get(String(r.client_id)) : null;
    return {
      id: String(r.id),
      clientId: String(r.client_id),
      clientName: cl ? String(cl.name) : "—",
      categoryId: r.category_id ? String(r.category_id) : null,
      categoryName: cat ? String(cat.name) : null,
      categoryColor: cat ? String(cat.color) : null,
      statusId: r.status_id ? String(r.status_id) : null,
      statusName: st ? String(st.name) : null,
      statusColor: st ? String(st.color) : null,
      title: String(r.title),
      description: r.description ? String(r.description) : null,
      caption: r.caption ? String(r.caption) : null,
      scheduledAt: r.scheduled_at ? String(r.scheduled_at) : null,
      deliveryAt: r.delivery_at ? String(r.delivery_at) : null,
      responsibleId: r.responsible_id ? String(r.responsible_id) : null,
      videoUrl: r.video_url ? String(r.video_url) : null,
      attachmentCount: attachCountMap.get(String(r.id)) ?? 0,
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    };
  });
}

export async function listEditorialResponsibles(): Promise<EditorialResponsible[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id, name, email")
    .eq("global_role", "vitti_admin")
    .eq("status", "active");
  return (data ?? []).map((r) => ({
    id: String(r.id),
    name: String(r.name ?? r.email ?? "Admin Vitti"),
  }));
}

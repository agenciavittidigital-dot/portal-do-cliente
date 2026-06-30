import "server-only";
import { createAdminClient as mkAdmin } from "@/lib/supabase/admin";

export interface BannerRow {
  id: string;
  storagePath: string;
  linkUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

function mapRow(r: Record<string, unknown>): BannerRow {
  return {
    id: String(r.id),
    storagePath: String(r.storage_path),
    linkUrl: r.link_url ? String(r.link_url) : null,
    sortOrder: Number(r.sort_order ?? 0),
    isActive: Boolean(r.is_active),
    createdAt: String(r.created_at ?? ""),
    updatedAt: String(r.updated_at ?? ""),
  };
}

export async function listBanners(): Promise<BannerRow[]> {
  const admin = mkAdmin();
  const { data, error } = await admin
    .from("home_carousel_banners")
    .select("id, storage_path, link_url, sort_order, is_active, created_at, updated_at")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[listBanners]", error.message);
    return [];
  }
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

export async function listActiveBanners(): Promise<BannerRow[]> {
  const admin = mkAdmin();
  const { data, error } = await admin
    .from("home_carousel_banners")
    .select("id, storage_path, link_url, sort_order, is_active, created_at, updated_at")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[listActiveBanners]", error.message);
    return [];
  }
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

export async function createBanner(input: {
  storagePath: string;
  linkUrl: string | null;
  sortOrder: number;
  isActive: boolean;
}): Promise<BannerRow> {
  const admin = mkAdmin();
  const { data, error } = await admin
    .from("home_carousel_banners")
    .insert({
      storage_path: input.storagePath,
      link_url: input.linkUrl || null,
      sort_order: input.sortOrder,
      is_active: input.isActive,
    })
    .select("id, storage_path, link_url, sort_order, is_active, created_at, updated_at")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Erro ao criar banner.");
  return mapRow(data as Record<string, unknown>);
}

export async function updateBanner(
  id: string,
  patch: {
    storagePath?: string;
    linkUrl?: string | null;
    sortOrder?: number;
    isActive?: boolean;
  }
): Promise<BannerRow> {
  const admin = mkAdmin();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.storagePath !== undefined) update.storage_path = patch.storagePath;
  if ("linkUrl" in patch) update.link_url = patch.linkUrl || null;
  if (patch.sortOrder !== undefined) update.sort_order = patch.sortOrder;
  if (patch.isActive !== undefined) update.is_active = patch.isActive;

  const { data, error } = await admin
    .from("home_carousel_banners")
    .update(update)
    .eq("id", id)
    .select("id, storage_path, link_url, sort_order, is_active, created_at, updated_at")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Erro ao atualizar banner.");
  return mapRow(data as Record<string, unknown>);
}

export async function deleteBanner(id: string): Promise<string | null> {
  const admin = mkAdmin();
  const { data, error } = await admin
    .from("home_carousel_banners")
    .delete()
    .eq("id", id)
    .select("storage_path")
    .single();

  if (error) throw new Error(error.message);
  return data?.storage_path ? String(data.storage_path) : null;
}

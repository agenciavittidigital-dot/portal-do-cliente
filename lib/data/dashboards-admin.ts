import "server-only";
import { createAdminClient as mkAdmin } from "@/lib/supabase/admin";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AdminClientSummary {
  id: string;
  name: string;
  slug: string;
  segment: string | null;
  status: string;
  windsorMappings: number;
  performanceRecords: number;
}

export interface AdminBlockMetric {
  id: string;
  block_id: string;
  metric_id: string;
  display_name: string | null;
  source_field: string | null;
  position: number;
  visible: boolean;
  show_variation: boolean | null;
  show_sparkline: boolean | null;
  visualization_type: string | null;
  metricKey: string | null;
  metricName: string | null;
  metricFormat: string | null;
}

export interface AdminDashboardBlock {
  id: string;
  dashboard_id: string;
  channel: string | null;
  block_type: string;
  title: string | null;
  description: string | null;
  position: number;
  size: string | null;
  visible: boolean;
  settings: Record<string, unknown> | null;
  metrics: AdminBlockMetric[];
}

export interface AdminDashboard {
  id: string;
  client_id: string;
  name: string | null;
  status: string;
  default_channel: string | null;
  available_channels: string[];
  settings: Record<string, unknown> | null;
  blocks: AdminDashboardBlock[];
  totalBlocks: number;
  totalMetrics: number;
}

export interface ClientDashboardConfig {
  client: AdminClientSummary;
  dashboards: AdminDashboard[];
}

// ── List ──────────────────────────────────────────────────────────────────────

export async function listClientDashboardConfig(
  clientId: string
): Promise<ClientDashboardConfig | null> {
  const admin = mkAdmin();

  const { data: clientRow } = await admin
    .from("clients")
    .select("id, name, slug, segment, status")
    .eq("id", clientId)
    .maybeSingle();

  if (!clientRow) return null;

  const [{ count: windsorCount }, { count: perfCount }] = await Promise.all([
    admin
      .from("client_integrations")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("provider", "windsor")
      .eq("channel", "meta_ads")
      .eq("status", "active"),
    admin
      .from("performance_daily")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId),
  ]);

  const client: AdminClientSummary = {
    id: String(clientRow.id),
    name: String(clientRow.name ?? ""),
    slug: String(clientRow.slug ?? ""),
    segment: clientRow.segment ? String(clientRow.segment) : null,
    status: String(clientRow.status ?? ""),
    windsorMappings: windsorCount ?? 0,
    performanceRecords: perfCount ?? 0,
  };

  // All dashboards — no status filter (admin sees draft + published)
  const { data: dashRows, error: dashErr } = await admin
    .from("client_dashboards")
    .select("id, client_id, name, status, default_channel, available_channels")
    .eq("client_id", clientId)
    .order("name");

  if (dashErr) {
    console.error("[listClientDashboardConfig] Erro ao carregar dashboards:", dashErr.message);
    return { client, dashboards: [] };
  }

  if (!dashRows?.length) return { client, dashboards: [] };

  const dashIds = dashRows.map((r) => String(r.id));

  // All blocks — no visible filter
  const { data: blockRows } = await admin
    .from("dashboard_blocks")
    .select("id, dashboard_id, channel, block_type, title, description, position, size, visible, settings")
    .in("dashboard_id", dashIds)
    .order("position");

  const blockIds = (blockRows ?? []).map((r) => String(r.id));

  // All metrics — no visible filter
  let rawMetrics: Array<Record<string, unknown>> = [];
  if (blockIds.length > 0) {
    const { data: bmData } = await admin
      .from("dashboard_block_metrics")
      .select(
        "id, block_id, metric_id, display_name, source_field, position, visible, show_variation, show_sparkline, visualization_type"
      )
      .in("block_id", blockIds)
      .order("position");
    rawMetrics = (bmData ?? []) as Array<Record<string, unknown>>;
  }

  // Catalog for key/name/format
  const metricIds = [...new Set(rawMetrics.map((r) => String(r.metric_id)))];
  const catalogById = new Map<string, { key: string; name: string; format: string | null }>();
  if (metricIds.length > 0) {
    const { data: catalogData } = await admin
      .from("metric_catalog")
      .select("id, key, name, format")
      .in("id", metricIds);
    for (const c of catalogData ?? []) {
      catalogById.set(String(c.id), {
        key: String(c.key ?? ""),
        name: String(c.name ?? ""),
        format: c.format ? String(c.format) : null,
      });
    }
  }

  // Assemble
  const metricsByBlockId = new Map<string, AdminBlockMetric[]>();
  for (const r of rawMetrics) {
    const bid = String(r.block_id);
    const cat = catalogById.get(String(r.metric_id));
    const m: AdminBlockMetric = {
      id: String(r.id),
      block_id: bid,
      metric_id: String(r.metric_id),
      display_name: r.display_name ? String(r.display_name) : null,
      source_field: r.source_field ? String(r.source_field) : null,
      position: Number(r.position ?? 0),
      visible: r.visible !== false,
      show_variation: r.show_variation != null ? Boolean(r.show_variation) : null,
      show_sparkline: r.show_sparkline != null ? Boolean(r.show_sparkline) : null,
      visualization_type: r.visualization_type ? String(r.visualization_type) : null,
      metricKey: cat?.key ?? null,
      metricName: cat?.name ?? null,
      metricFormat: cat?.format ?? null,
    };
    const list = metricsByBlockId.get(bid) ?? [];
    list.push(m);
    metricsByBlockId.set(bid, list);
  }

  const blocksByDashId = new Map<string, AdminDashboardBlock[]>();
  for (const r of blockRows ?? []) {
    const did = String(r.dashboard_id);
    const bid = String(r.id);
    const block: AdminDashboardBlock = {
      id: bid,
      dashboard_id: did,
      channel: r.channel ? String(r.channel) : null,
      block_type: String(r.block_type ?? ""),
      title: r.title ? String(r.title) : null,
      description: r.description ? String(r.description) : null,
      position: Number(r.position ?? 0),
      size: r.size ? String(r.size) : null,
      visible: r.visible !== false,
      settings: (r.settings as Record<string, unknown>) ?? null,
      metrics: metricsByBlockId.get(bid) ?? [],
    };
    const list = blocksByDashId.get(did) ?? [];
    list.push(block);
    blocksByDashId.set(did, list);
  }

  const dashboards: AdminDashboard[] = dashRows.map((r) => {
    const did = String(r.id);
    const blocks = blocksByDashId.get(did) ?? [];
    return {
      id: did,
      client_id: String(r.client_id),
      name: r.name ? String(r.name) : null,
      status: String(r.status ?? ""),
      default_channel: r.default_channel ? String(r.default_channel) : null,
      available_channels: Array.isArray(r.available_channels)
        ? (r.available_channels as unknown[]).map(String)
        : [],
      settings: null,
      blocks,
      totalBlocks: blocks.length,
      totalMetrics: blocks.reduce((s, b) => s + b.metrics.length, 0),
    };
  });

  return { client, dashboards };
}

// ── Update dashboard ──────────────────────────────────────────────────────────

export async function updateAdminDashboard(
  id: string,
  patch: { status?: "published" | "draft"; settingsPatch?: Record<string, unknown> }
): Promise<void> {
  const admin = mkAdmin();
  const update: Record<string, unknown> = {};

  if (patch.status !== undefined) update.status = patch.status;

  // settingsPatch is intentionally ignored — client_dashboards has no settings column

  if (Object.keys(update).length === 0) return;

  const { error } = await admin.from("client_dashboards").update(update).eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Update block ──────────────────────────────────────────────────────────────

export async function updateAdminDashboardBlock(
  id: string,
  patch: {
    visible?: boolean;
    title?: string | null;
    description?: string | null;
    position?: number;
    size?: string | null;
    settingsPatch?: Record<string, unknown>;
  }
): Promise<void> {
  const admin = mkAdmin();
  const update: Record<string, unknown> = {};

  if (patch.visible !== undefined) update.visible = patch.visible;
  if ("title" in patch) update.title = patch.title;
  if ("description" in patch) update.description = patch.description;
  if (patch.position !== undefined) update.position = patch.position;
  if ("size" in patch) update.size = patch.size;

  if (patch.settingsPatch) {
    const { data: current } = await admin
      .from("dashboard_blocks")
      .select("settings")
      .eq("id", id)
      .maybeSingle();
    const existing = (current?.settings as Record<string, unknown>) ?? {};
    update.settings = { ...existing, ...patch.settingsPatch };
  }

  if (Object.keys(update).length === 0) return;

  const { error } = await admin.from("dashboard_blocks").update(update).eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Update metric ─────────────────────────────────────────────────────────────

export async function updateAdminDashboardBlockMetric(
  id: string,
  patch: {
    visible?: boolean;
    display_name?: string | null;
    position?: number;
    show_variation?: boolean | null;
    show_sparkline?: boolean | null;
  }
): Promise<void> {
  const admin = mkAdmin();
  const update: Record<string, unknown> = {};

  if (patch.visible !== undefined) update.visible = patch.visible;
  if ("display_name" in patch) update.display_name = patch.display_name;
  if (patch.position !== undefined) update.position = patch.position;
  if ("show_variation" in patch) update.show_variation = patch.show_variation;
  if ("show_sparkline" in patch) update.show_sparkline = patch.show_sparkline;

  const { error } = await admin.from("dashboard_block_metrics").update(update).eq("id", id);
  if (error) throw new Error(error.message);
}

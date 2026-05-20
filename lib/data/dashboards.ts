import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Client,
  ClientDashboard,
  DashboardBlock,
  MetricCatalog,
  BlockMetric,
  BlockWithMetrics,
  DashboardWithBlocks,
} from "@/types";

export type { BlockWithMetrics, DashboardWithBlocks };

export async function loadActiveClients(): Promise<{
  clients: Client[];
  loadError: boolean;
}> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("clients")
      .select("id, name, slug, segment, status, logo_url")
      .eq("status", "active")
      .order("name");

    if (error) return { clients: [], loadError: true };

    const clients = (data ?? []).map((r) => ({
      id: String(r.id ?? ""),
      name: String(r.name ?? ""),
      slug: String(r.slug ?? ""),
      segment: r.segment ? String(r.segment) : null,
      status: String(r.status ?? ""),
      logo_url: r.logo_url ? String(r.logo_url) : null,
    }));

    return { clients, loadError: false };
  } catch {
    return { clients: [], loadError: true };
  }
}

export async function loadClientDashboards(
  clientId: string
): Promise<DashboardWithBlocks[]> {
  try {
    const admin = createAdminClient();

    // ── Etapa A: Dashboards do cliente ────────────────────────────
    const { data: dashRows, error: dashError } = await admin
      .from("client_dashboards")
      .select("id, client_id, name, status, default_channel, available_channels")
      .eq("client_id", clientId)
      .eq("status", "published");

    if (dashError || !dashRows?.length) return [];

    const dashboardIds = dashRows.map((r) => String(r.id));

    // ── Etapa B: Blocos de todos os dashboards ────────────────────
    const { data: blockRows, error: blocksError } = await admin
      .from("dashboard_blocks")
      .select(
        "id, dashboard_id, channel, block_type, title, description, position, size, visible, empty_state_message, settings"
      )
      .in("dashboard_id", dashboardIds)
      .eq("visible", true)
      .order("position");

    if (blocksError) return [];

    // ── Etapa C: IDs dos blocos ───────────────────────────────────
    const blockIds = (blockRows ?? []).map((r) => String(r.id));

    // ── Etapa D: Métricas dos blocos (junction) ───────────────────
    let blockMetricRows: Array<{
      id: string;
      block_id: string;
      metric_id: string;
      display_name: string | null;
      source_field: string | null;
      position: number;
      visible: boolean;
      show_variation: boolean | null;
      show_sparkline: boolean | null;
      compare_previous_period: boolean | null;
      visualization_type: string | null;
      custom_formula: string | null;
      settings: Record<string, unknown> | null;
    }> = [];

    if (blockIds.length > 0) {
      const { data: bmData, error: bmError } = await admin
        .from("dashboard_block_metrics")
        .select(
          "id, block_id, metric_id, display_name, source_field, position, visible, show_variation, show_sparkline, compare_previous_period, visualization_type, custom_formula, settings"
        )
        .in("block_id", blockIds)
        .eq("visible", true)
        .order("position");

      if (!bmError) {
        blockMetricRows = (bmData ?? []).map((r) => ({
          id: String(r.id ?? ""),
          block_id: String(r.block_id ?? ""),
          metric_id: String(r.metric_id ?? ""),
          display_name: r.display_name ? String(r.display_name) : null,
          source_field: r.source_field ? String(r.source_field) : null,
          position: Number(r.position ?? 0),
          visible: r.visible === true,
          show_variation: r.show_variation != null ? Boolean(r.show_variation) : null,
          show_sparkline: r.show_sparkline != null ? Boolean(r.show_sparkline) : null,
          compare_previous_period: r.compare_previous_period != null ? Boolean(r.compare_previous_period) : null,
          visualization_type: r.visualization_type ? String(r.visualization_type) : null,
          custom_formula: r.custom_formula ? String(r.custom_formula) : null,
          settings: (r.settings as Record<string, unknown>) ?? null,
        }));
      }
    }

    // ── Etapa E: IDs únicos das métricas do catálogo ──────────────
    const metricIds = [...new Set(blockMetricRows.map((r) => r.metric_id).filter(Boolean))];

    // ── Etapa F: Catálogo de métricas ─────────────────────────────
    let catalogById = new Map<string, MetricCatalog>();

    if (metricIds.length > 0) {
      const { data: catalogData, error: catalogError } = await admin
        .from("metric_catalog")
        .select(
          "id, key, name, description, channel, default_source_field, data_type, format, calculation_type, calculation_formula, positive_direction, unit, is_active"
        )
        .in("id", metricIds)
        .eq("is_active", true);

      if (!catalogError) {
        const catalogs: MetricCatalog[] = (catalogData ?? []).map((r) => ({
          id: String(r.id ?? ""),
          key: String(r.key ?? ""),
          name: String(r.name ?? ""),
          description: r.description ? String(r.description) : null,
          channel: r.channel ? String(r.channel) : null,
          default_source_field: r.default_source_field ? String(r.default_source_field) : null,
          data_type: r.data_type ? String(r.data_type) : null,
          format: r.format ? String(r.format) : null,
          calculation_type: r.calculation_type ? String(r.calculation_type) : null,
          calculation_formula: r.calculation_formula ? String(r.calculation_formula) : null,
          positive_direction: r.positive_direction ? String(r.positive_direction) : null,
          unit: r.unit ? String(r.unit) : null,
          is_active: r.is_active === true,
        }));
        catalogById = new Map(catalogs.map((c) => [c.id, c]));
      }
    }

    // ── Etapa G: Agrupa junction rows por block_id ────────────────
    const junctionByBlockId = new Map<string, typeof blockMetricRows>();
    for (const row of blockMetricRows) {
      const list = junctionByBlockId.get(row.block_id) ?? [];
      list.push(row);
      junctionByBlockId.set(row.block_id, list);
    }

    // ── Etapa H: Monta DashboardWithBlocks[] ─────────────────────
    const blocksByDashId = new Map<string, BlockWithMetrics[]>();

    for (const r of blockRows ?? []) {
      const dashId = String(r.dashboard_id);
      const block: DashboardBlock = {
        id: String(r.id ?? ""),
        dashboard_id: dashId,
        block_type: String(r.block_type ?? ""),
        title: r.title != null ? String(r.title) : null,
        channel: r.channel != null ? String(r.channel) : null,
        position: Number(r.position ?? 0),
        visible: r.visible === true,
        settings: (r.settings as Record<string, unknown>) ?? null,
      };

      const junctionRows = junctionByBlockId.get(block.id) ?? [];
      const metrics: BlockMetric[] = junctionRows.map((j) => ({
        id: j.id,
        block_id: j.block_id,
        metric_id: j.metric_id,
        display_name: j.display_name,
        source_field: j.source_field,
        position: j.position,
        visible: j.visible,
        show_variation: j.show_variation,
        show_sparkline: j.show_sparkline,
        compare_previous_period: j.compare_previous_period,
        visualization_type: j.visualization_type,
        custom_formula: j.custom_formula,
        settings: j.settings,
        catalog: catalogById.get(j.metric_id) ?? null,
      }));

      const list = blocksByDashId.get(dashId) ?? [];
      list.push({ block, metrics });
      blocksByDashId.set(dashId, list);
    }

    return dashRows.map((r) => {
      const availableChannels = Array.isArray(r.available_channels)
        ? (r.available_channels as unknown[]).map(String)
        : [];
      const dashboard: ClientDashboard = {
        id: String(r.id ?? ""),
        client_id: String(r.client_id ?? ""),
        platform: String(r.default_channel ?? ""),
        available_channels: availableChannels,
        name: r.name ? String(r.name) : null,
        status: String(r.status ?? ""),
      };
      return { dashboard, blocks: blocksByDashId.get(dashboard.id) ?? [] };
    });
  } catch (err) {
    console.error("[loadClientDashboards] Erro:", err);
    return [];
  }
}

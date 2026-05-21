import "server-only";
import { createAdminClient as mkAdmin } from "@/lib/supabase/admin";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AdminClientRow {
  id: string;
  name: string;
  slug: string;
  segment: string | null;
  status: string;
  created_at: string;
  publishedDashboards: number;
  windsorMappings: number;
}

export interface CreateClientInput {
  name: string;
  slug: string;
  segment: string | null;
  status: "active" | "inactive";
}

export interface UpdateClientInput {
  name?: string;
  slug?: string;
  segment?: string | null;
  status?: "active" | "inactive";
}

export interface EnsureDashboardResult {
  dashboardId: string;
  dashboardCreated: boolean;
  blocksCreated: number;
  blocksExisting: number;
  metricsCreated: number;
  metricsExisting: number;
  totalBlocks: number;
  totalMetrics: number;
  message: string;
}

// ── Slugify ───────────────────────────────────────────────────────────────────

export function slugifyName(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

// ── List ──────────────────────────────────────────────────────────────────────

export async function listAdminClients(): Promise<AdminClientRow[]> {
  const admin = mkAdmin();

  const { data: clientRows, error } = await admin
    .from("clients")
    .select("id, name, slug, segment, status, created_at")
    .order("name");

  if (error || !clientRows?.length) return [];

  const clientIds = clientRows.map((r) => String(r.id));

  const [{ data: dashRows }, { data: integRows }] = await Promise.all([
    admin
      .from("client_dashboards")
      .select("client_id")
      .in("client_id", clientIds)
      .eq("status", "published"),
    admin
      .from("client_integrations")
      .select("client_id")
      .in("client_id", clientIds)
      .eq("provider", "windsor")
      .eq("channel", "meta_ads")
      .eq("status", "active"),
  ]);

  const dashCount = new Map<string, number>();
  for (const r of dashRows ?? []) {
    const id = String(r.client_id);
    dashCount.set(id, (dashCount.get(id) ?? 0) + 1);
  }

  const integCount = new Map<string, number>();
  for (const r of integRows ?? []) {
    const id = String(r.client_id);
    integCount.set(id, (integCount.get(id) ?? 0) + 1);
  }

  return clientRows.map((r) => ({
    id: String(r.id),
    name: String(r.name ?? ""),
    slug: String(r.slug ?? ""),
    segment: r.segment ? String(r.segment) : null,
    status: String(r.status ?? ""),
    created_at: String(r.created_at ?? ""),
    publishedDashboards: dashCount.get(String(r.id)) ?? 0,
    windsorMappings: integCount.get(String(r.id)) ?? 0,
  }));
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createAdminClient(
  input: CreateClientInput
): Promise<{ id: string } | { error: string; detail?: string }> {
  const admin = mkAdmin();

  const { data: existing } = await admin
    .from("clients")
    .select("id")
    .eq("slug", input.slug)
    .maybeSingle();

  if (existing) {
    return {
      error: "Slug já em uso.",
      detail: `O slug '${input.slug}' já pertence a outro cliente.`,
    };
  }

  const { data, error } = await admin
    .from("clients")
    .insert({
      name: input.name,
      slug: input.slug,
      segment: input.segment || null,
      status: input.status,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: "Erro ao criar cliente.", detail: error?.message };
  }

  return { id: String(data.id) };
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateAdminClient(
  id: string,
  input: UpdateClientInput
): Promise<{ success: true } | { error: string; detail?: string }> {
  const admin = mkAdmin();

  if (input.slug !== undefined) {
    const { data: existing } = await admin
      .from("clients")
      .select("id")
      .eq("slug", input.slug)
      .neq("id", id)
      .maybeSingle();

    if (existing) {
      return {
        error: "Slug já em uso.",
        detail: `O slug '${input.slug}' já pertence a outro cliente.`,
      };
    }
  }

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.slug !== undefined) patch.slug = input.slug;
  if ("segment" in input) patch.segment = input.segment;
  if (input.status !== undefined) patch.status = input.status;

  const { error } = await admin.from("clients").update(patch).eq("id", id);

  if (error) {
    return { error: "Erro ao atualizar cliente.", detail: error.message };
  }

  return { success: true };
}

// ── Ensure default dashboard ──────────────────────────────────────────────────

const DEFAULT_BLOCKS: ReadonlyArray<{
  readonly title: string;
  readonly position: number;
  readonly metricKeys: string[];
}> = [
  {
    title: "Visão Geral",
    position: 1,
    metricKeys: ["spend", "impressions", "reach", "frequency"],
  },
  {
    title: "Performance",
    position: 2,
    metricKeys: ["clicks", "ctr", "cpc", "cpm"],
  },
  {
    title: "Conversões",
    position: 3,
    metricKeys: ["leads", "cost_per_lead", "messages_started", "purchases"],
  },
];

export async function ensureDefaultDashboard(
  clientId: string
): Promise<EnsureDashboardResult> {
  const admin = mkAdmin();

  let dashboardCreated = false;
  let blocksCreated = 0;
  let blocksExisting = 0;
  let metricsCreated = 0;
  let metricsExisting = 0;

  // ── Etapa 1: Garantir dashboard ───────────────────────────────────────────

  const { data: existingDash } = await admin
    .from("client_dashboards")
    .select("id")
    .eq("client_id", clientId)
    .eq("name", "Dashboard Principal")
    .maybeSingle();

  let dashboardId: string;

  if (existingDash) {
    dashboardId = String(existingDash.id);
  } else {
    const { data: newDash, error: dashErr } = await admin
      .from("client_dashboards")
      .insert({
        client_id: clientId,
        name: "Dashboard Principal",
        status: "published",
        default_channel: "meta_ads",
        available_channels: ["meta_ads"],
      })
      .select("id")
      .single();

    if (dashErr || !newDash) {
      throw new Error(`Erro ao criar dashboard: ${dashErr?.message ?? "desconhecido"}`);
    }

    dashboardId = String(newDash.id);
    dashboardCreated = true;
  }

  // ── Etapa 2: Carregar catálogo de métricas ────────────────────────────────

  const allKeys = DEFAULT_BLOCKS.flatMap((b) => b.metricKeys);

  const { data: catalogRows, error: catalogErr } = await admin
    .from("metric_catalog")
    .select("id, key")
    .in("key", allKeys)
    .eq("is_active", true);

  if (catalogErr) {
    throw new Error(`Erro ao carregar catálogo de métricas: ${catalogErr.message}`);
  }

  const metricIdByKey = new Map<string, string>(
    (catalogRows ?? []).map((r) => [String(r.key), String(r.id)])
  );

  // Falha clara se alguma key não existir no catálogo
  const missingKeys = allKeys.filter((k) => !metricIdByKey.has(k));
  if (missingKeys.length > 0) {
    throw new Error(
      `Métricas não encontradas no metric_catalog: ${missingKeys.join(", ")}. ` +
        "Verifique se as keys estão cadastradas e is_active=true."
    );
  }

  // ── Etapa 3: Carregar blocos existentes do dashboard ─────────────────────

  const { data: existingBlockRows } = await admin
    .from("dashboard_blocks")
    .select("id, title")
    .eq("dashboard_id", dashboardId);

  // title → blockId para blocos que já existem
  const blockIdByTitle = new Map<string, string>(
    (existingBlockRows ?? []).map((b) => [String(b.title ?? ""), String(b.id)])
  );

  // ── Etapa 4: Para cada bloco padrão — criar se não existe, garantir métricas

  for (const group of DEFAULT_BLOCKS) {
    let blockId: string;

    if (blockIdByTitle.has(group.title)) {
      blockId = blockIdByTitle.get(group.title)!;
      blocksExisting++;
    } else {
      // Criar bloco — block_type confirmado pelo schema real
      const { data: newBlock, error: blockErr } = await admin
        .from("dashboard_blocks")
        .insert({
          dashboard_id: dashboardId,
          channel: "meta_ads",
          block_type: "kpi_grid",
          title: group.title,
          position: group.position,
          visible: true,
        })
        .select("id")
        .single();

      if (blockErr || !newBlock) {
        throw new Error(
          `Erro ao criar bloco "${group.title}": ${blockErr?.message ?? "resposta vazia"}`
        );
      }

      blockId = String(newBlock.id);
      blocksCreated++;
    }

    // ── Etapa 5: Garantir métricas vinculadas ao bloco ──────────────────────

    const { data: existingMetricRows } = await admin
      .from("dashboard_block_metrics")
      .select("metric_id")
      .eq("block_id", blockId);

    const existingMetricIds = new Set(
      (existingMetricRows ?? []).map((m) => String(m.metric_id))
    );

    const metricsToInsert = group.metricKeys
      .map((key, idx) => ({
        block_id: blockId,
        metric_id: metricIdByKey.get(key)!,
        position: idx + 1,
        visible: true,
      }))
      .filter((m) => !existingMetricIds.has(m.metric_id));

    metricsExisting += group.metricKeys.length - metricsToInsert.length;

    if (metricsToInsert.length > 0) {
      const { error: metErr } = await admin
        .from("dashboard_block_metrics")
        .insert(metricsToInsert);

      if (metErr) {
        throw new Error(
          `Erro ao vincular métricas ao bloco "${group.title}": ${metErr.message}`
        );
      }

      metricsCreated += metricsToInsert.length;
    }
  }

  const totalBlocks = blocksCreated + blocksExisting;
  const totalMetrics = metricsCreated + metricsExisting;

  const parts: string[] = [];
  if (dashboardCreated) parts.push("dashboard criado");
  if (blocksCreated > 0) parts.push(`${blocksCreated} bloco(s) criado(s)`);
  if (metricsCreated > 0) parts.push(`${metricsCreated} métrica(s) vinculada(s)`);

  const message =
    parts.length > 0
      ? `Concluído: ${parts.join(", ")}.`
      : `Tudo já estava configurado (${totalBlocks} blocos, ${totalMetrics} métricas).`;

  return {
    dashboardId,
    dashboardCreated,
    blocksCreated,
    blocksExisting,
    metricsCreated,
    metricsExisting,
    totalBlocks,
    totalMetrics,
    message,
  };
}

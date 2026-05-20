export type GlobalRole = "vitti_admin" | "client_user";

export interface Profile {
  id: string;           // PK do profiles — usado como FK em client_users e user_permissions
  auth_user_id: string; // referencia auth.users.id
  name: string | null;
  email: string | null;
  global_role: GlobalRole;
  status: string;       // "active" | "inactive" | outros
}

export interface Client {
  id: string;
  name: string;
  slug: string;
  segment: string | null;
  status: string;
  logo_url: string | null;
}

export interface Permission {
  id: string;
  name: string;
  description: string | null;
}

export type PermissionKey =
  | "home.view"
  | "dashboard.view"
  | "reports.view"
  | "finance.view"
  | "invoices.view"
  | "calls.view"
  | "education.view"
  | "admin.view"
  | (string & {});

export interface NavItem {
  label: string;
  href: string;
}

// ── Sprint 4: Dashboards configuráveis ────────────────────────────────────────

export type PlatformKey = "meta_ads" | "google_ads" | "seo" | "social_media";

export interface ClientDashboard {
  id: string;
  client_id: string;
  platform: string;            // mapeado de default_channel
  available_channels: string[];
  name: string | null;
  status: string;
}

export interface DashboardBlock {
  id: string;
  dashboard_id: string;
  block_type: string;
  title: string | null;
  channel: string | null;
  position: number;
  visible: boolean;
  settings: Record<string, unknown> | null;
}

// Schema real de public.metric_catalog
export interface MetricCatalog {
  id: string;
  key: string;
  name: string;
  description: string | null;
  channel: string | null;
  default_source_field: string | null;
  data_type: string | null;
  format: string | null;
  calculation_type: string | null;
  calculation_formula: string | null;
  positive_direction: string | null;
  unit: string | null;
  is_active: boolean;
}

// Schema real de public.dashboard_block_metrics + catalog embutido
export interface BlockMetric {
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
  catalog: MetricCatalog | null;
}

export interface BlockWithMetrics {
  block: DashboardBlock;
  metrics: BlockMetric[];
}

export interface DashboardWithBlocks {
  dashboard: ClientDashboard;
  blocks: BlockWithMetrics[];
}

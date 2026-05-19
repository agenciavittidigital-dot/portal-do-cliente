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
  logo_url: string | null;
  active: boolean;
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

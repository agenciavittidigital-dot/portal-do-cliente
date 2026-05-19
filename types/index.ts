export type UserRole = "admin" | "client";

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
}

export interface Client {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  active: boolean;
}

export interface NavItem {
  label: string;
  href: string;
}

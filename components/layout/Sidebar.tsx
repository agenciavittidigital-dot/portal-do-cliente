"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  BarChart3,
  FileText,
  CreditCard,
  Video,
  GraduationCap,
  Settings,
  LogOut,
  LockKeyhole,
  PanelLeftClose,
  PanelRightOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface NavItemDef {
  label: string;
  href: string;
  icon: React.ElementType;
  permission: string;
  alsoActiveOn: string[];
}

const ALL_NAV_ITEMS: NavItemDef[] = [
  {
    label: "Home",
    href: "/dashboard",
    icon: LayoutDashboard,
    permission: "view_home",
    alsoActiveOn: [],
  },
  {
    label: "Dados e Métricas",
    href: "/metricas",
    icon: BarChart3,
    permission: "view_metrics",
    alsoActiveOn: [],
  },
  {
    label: "Relatórios",
    href: "/relatorios",
    icon: FileText,
    permission: "view_reports",
    alsoActiveOn: [],
  },
  {
    label: "Financeiro",
    href: "/financeiro",
    icon: CreditCard,
    permission: "view_finance",
    alsoActiveOn: ["/notas-fiscais"],
  },
  {
    label: "Calls",
    href: "/calls",
    icon: Video,
    permission: "view_calls",
    alsoActiveOn: [],
  },
  {
    label: "Educação",
    href: "/educacao",
    icon: GraduationCap,
    permission: "view_education",
    alsoActiveOn: [],
  },
];

interface SidebarProps {
  permissions: string[];
  isAdmin: boolean;
}

export function Sidebar({ permissions, isAdmin }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const navItems = isAdmin
    ? ALL_NAV_ITEMS
    : ALL_NAV_ITEMS.filter((item) => permissions.includes(item.permission));

  const itemBase = cn(
    "flex items-center gap-3 rounded-xl px-3 py-3 text-sm",
    "transition-all duration-200"
  );
  const itemNormal = "text-white/60 hover:bg-white/5 hover:text-white";
  const itemActive = "bg-white/15 text-white font-medium";

  const collapsedItemBase = cn(
    "flex items-center justify-center rounded-xl p-2.5",
    "transition-all duration-200"
  );

  return (
    <aside
      className={cn(
        "relative flex flex-col overflow-hidden bg-[#171F38] shrink-0",
        "transition-all duration-300",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Background image overlay */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/bg-sidebar.png"
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-90 pointer-events-none"
        style={{ zIndex: 0 }}
      />

      <div className="relative flex flex-1 flex-col" style={{ zIndex: 1 }}>

        {/* Header */}
        <div
          className={cn(
            "flex h-14 items-center border-b border-white/10 transition-all duration-300",
            collapsed ? "justify-center px-0" : "justify-between px-4"
          )}
        >
          <div className="flex items-center gap-3 min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-vitti-icon.png"
              alt="Vitti"
              className="h-10 w-auto object-contain shrink-0"
            />
            {!collapsed && (
              <p className="truncate text-sm font-semibold tracking-tight text-white">
                Portal do Cliente
              </p>
            )}
          </div>
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              title="Recolher menu"
              className="rounded-lg p-1.5 text-white/40 transition-all duration-200 hover:bg-white/10 hover:text-white"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Expand button (collapsed state) */}
        {collapsed && (
          <div className="flex justify-center border-b border-white/10 py-2">
            <button
              onClick={() => setCollapsed(false)}
              title="Expandir menu"
              className="rounded-lg p-1.5 text-white/40 transition-all duration-200 hover:bg-white/10 hover:text-white"
            >
              <PanelRightOpen className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Navigation */}
        <nav
          className={cn(
            "flex flex-1 flex-col gap-0.5 py-2 overflow-y-auto overflow-x-hidden",
            collapsed ? "items-center px-2" : "px-4"
          )}
        >
          {navItems.length > 0 ? (
            navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                pathname.startsWith(item.href + "/") ||
                item.alsoActiveOn.some(
                  (p) => pathname === p || pathname.startsWith(p + "/")
                );
              const Icon = item.icon;

              if (collapsed) {
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.label}
                    className={cn(collapsedItemBase, isActive ? itemActive : itemNormal)}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                  </Link>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(itemBase, isActive ? itemActive : itemNormal)}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })
          ) : (
            <div
              className={cn(
                "flex flex-col items-center gap-2 py-6",
                collapsed ? "px-1" : "px-3"
              )}
            >
              <LockKeyhole className="h-4 w-4 text-white/10" />
              {!collapsed && (
                <p className="text-[11px] text-white/15 font-light leading-relaxed text-center">
                  Nenhum módulo disponível.
                  <br />
                  Contate a equipe Vitti.
                </p>
              )}
            </div>
          )}
        </nav>

        {/* Footer */}
        <div
          className={cn(
            "border-t border-white/10 transition-all duration-300",
            collapsed ? "flex flex-col items-center gap-1 p-2" : "p-4"
          )}
        >
          {isAdmin && (
            <Link
              href="/admin"
              title={collapsed ? "Admin" : undefined}
              className={cn(
                collapsed ? collapsedItemBase : cn(itemBase, "mb-0.5 w-full"),
                pathname === "/admin" || pathname.startsWith("/admin/")
                  ? itemActive
                  : itemNormal
              )}
            >
              <Settings className="h-4 w-4 shrink-0" />
              {!collapsed && <span>Admin</span>}
            </Link>
          )}

          <button
            onClick={handleSignOut}
            title={collapsed ? "Sair" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-xl transition-all duration-200",
              "text-white/50 hover:bg-white/10 hover:text-white",
              collapsed ? "p-2" : "w-full px-3 py-2 text-xs"
            )}
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" />
            {!collapsed && "Sair"}
          </button>
        </div>

      </div>
    </aside>
  );
}

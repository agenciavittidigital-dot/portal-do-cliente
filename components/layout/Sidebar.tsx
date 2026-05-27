"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard,
  BarChart3,
  FileText,
  CreditCard,
  Video,
  GraduationCap,
  Settings,
  LogOut,
  ChevronLeft,
  LockKeyhole,
} from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

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

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-vitti-dark border-r border-white/5 transition-all duration-300 shrink-0",
        collapsed ? "w-[60px]" : "w-56"
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-white/5 shrink-0">
        {!collapsed && (
          <span className="text-white font-semibold text-base tracking-wide select-none">
            vitti<span className="text-vitti-light">.</span>
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label="Toggle sidebar"
          className={cn(
            "p-1.5 rounded-md text-white/25 hover:text-white/60 hover:bg-white/5 transition-colors",
            collapsed ? "mx-auto" : "ml-auto"
          )}
        >
          <ChevronLeft
            size={15}
            className={cn(
              "transition-transform duration-300",
              collapsed && "rotate-180"
            )}
          />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto overflow-x-hidden">
        {navItems.length > 0 ? (
          navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              pathname.startsWith(item.href + "/") ||
              item.alsoActiveOn.some(
                (p) => pathname === p || pathname.startsWith(p + "/")
              );
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg text-sm font-light transition-all duration-150 group",
                  collapsed ? "px-0 py-2.5 justify-center" : "px-3 py-2.5",
                  isActive
                    ? "bg-vitti-blue/15 text-vitti-light border border-vitti-blue/20"
                    : "text-white/40 hover:text-white/80 hover:bg-white/5 border border-transparent"
                )}
              >
                <Icon
                  size={16}
                  className={cn(
                    "shrink-0 transition-colors",
                    isActive
                      ? "text-vitti-light"
                      : "text-white/30 group-hover:text-white/60"
                  )}
                />
                {!collapsed && (
                  <span className="truncate leading-none">{item.label}</span>
                )}
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
            <LockKeyhole size={16} className="text-white/10" />
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

      {/* Bottom actions */}
      <div className="px-2 py-3 border-t border-white/5 space-y-0.5 shrink-0">
        {isAdmin && (
          <Link
            href="/admin"
            title={collapsed ? "Admin" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg text-sm font-light transition-all border",
              pathname === "/admin" || pathname.startsWith("/admin/")
                ? "bg-vitti-blue/15 text-vitti-light border-vitti-blue/20"
                : "text-white/30 hover:text-white/60 hover:bg-white/5 border-transparent",
              collapsed ? "px-0 py-2.5 justify-center" : "px-3 py-2.5"
            )}
          >
            <Settings size={15} className="shrink-0" />
            {!collapsed && <span>Admin</span>}
          </Link>
        )}

        <button
          onClick={handleSignOut}
          title={collapsed ? "Sair" : undefined}
          className={cn(
            "w-full flex items-center gap-3 rounded-lg text-sm font-light text-white/30 hover:text-red-400/70 hover:bg-red-500/5 transition-all border border-transparent",
            collapsed ? "px-0 py-2.5 justify-center" : "px-3 py-2.5"
          )}
        >
          <LogOut size={15} className="shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
  );
}

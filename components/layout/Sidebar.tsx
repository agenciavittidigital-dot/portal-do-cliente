"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
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
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { label: "Home", href: "/dashboard", icon: LayoutDashboard, alsoActiveOn: [] },
  { label: "Dados e Métricas", href: "/metricas", icon: BarChart3, alsoActiveOn: [] },
  { label: "Relatórios", href: "/relatorios", icon: FileText, alsoActiveOn: [] },
  { label: "Financeiro", href: "/financeiro", icon: CreditCard, alsoActiveOn: ["/notas-fiscais"] },
  { label: "Calls", href: "/calls", icon: Video, alsoActiveOn: [] },
  { label: "Educação", href: "/educacao", icon: GraduationCap, alsoActiveOn: [] },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

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
        {navItems.map((item) => {
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
        })}
      </nav>

      {/* Bottom actions */}
      <div className="px-2 py-3 border-t border-white/5 space-y-0.5 shrink-0">
        <Link
          href="/admin"
          title={collapsed ? "Admin" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-lg text-sm font-light text-white/30 hover:text-white/60 hover:bg-white/5 transition-all border border-transparent",
            collapsed ? "px-0 py-2.5 justify-center" : "px-3 py-2.5"
          )}
        >
          <Settings size={15} className="shrink-0" />
          {!collapsed && <span>Admin</span>}
        </Link>

        <button
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

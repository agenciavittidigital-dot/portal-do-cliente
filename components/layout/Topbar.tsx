"use client";

import { useRef, useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { User, ChevronDown, LayoutGrid } from "lucide-react";

const pageTitles: Record<string, string> = {
  "/dashboard": "Home",
  "/metricas": "Dados e Métricas",
  "/relatorios": "Relatórios",
  "/financeiro": "Financeiro",
  "/notas-fiscais": "Notas Fiscais",
  "/calls": "Calls",
  "/educacao": "Educação",
  "/admin": "Admin",
};

interface TopbarProps {
  userEmail?: string | null;
  userName?: string | null;
  clientName?: string | null;
}

export function Topbar({ userEmail, userName, clientName }: TopbarProps) {
  const pathname = usePathname();
  const title = pageTitles[pathname] ?? "Portal";

  const displayName = userName ?? (userEmail ? userEmail.split("@")[0] : null);

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number } | null>(null);

  function toggleMenu() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      setMenuStyle({
        top: rect.bottom + 8,
        left: rect.right - 176,
      });
    }
    setOpen((v) => !v);
  }

  useEffect(() => {
    function handleDown(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleDown);
    return () => document.removeEventListener("mousedown", handleDown);
  }, []);

  return (
    <>
      <header className="h-14 flex items-center justify-between px-6 border-b border-white bg-white/80 backdrop-blur-md shadow-[0_2px_20px_rgb(0,0,0,0.04)] shrink-0">
        <p className="text-[10px] font-medium tracking-[0.18em] uppercase select-none text-vitti-fg-muted/60">
          {title}
        </p>

        <button
          ref={triggerRef}
          type="button"
          onClick={toggleMenu}
          className="flex items-center gap-2.5 pl-3 border-l border-slate-200/60 hover:opacity-80 transition-opacity cursor-pointer"
        >
          {displayName && (
            <div className="hidden sm:flex flex-col items-end gap-0.5 text-right">
              <div className="flex items-center gap-1">
                <p className="text-xs font-medium text-vitti-fg leading-none truncate max-w-[160px]">
                  {displayName}
                </p>
                <ChevronDown
                  size={11}
                  className={`text-vitti-fg-muted/50 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
                />
              </div>
              {clientName && (
                <p className="text-[10px] font-light text-vitti-fg-muted/70 leading-none truncate max-w-[160px]">
                  {clientName}
                </p>
              )}
            </div>
          )}
          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200/80 flex items-center justify-center shrink-0 shadow-sm">
            <User size={14} className="text-vitti-blue/60" />
          </div>
        </button>
      </header>

      {open && menuStyle && (
        <div
          ref={menuRef}
          style={{ position: "fixed", top: menuStyle.top, left: menuStyle.left, zIndex: 99999 }}
          className="w-44 pointer-events-auto bg-white border border-slate-200/70 rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.10)] py-1"
        >
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              window.location.assign("/selecionar-portal");
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-slate-50 transition-colors rounded-lg"
          >
            <LayoutGrid size={13} className="text-vitti-blue/50 shrink-0" />
            <span className="text-[12px] font-light text-vitti-fg/80">Contas</span>
          </button>
        </div>
      )}
    </>
  );
}

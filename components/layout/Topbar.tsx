"use client";

import { useRef, useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import Image from "next/image";
import { User, ChevronDown, LayoutGrid, UserCircle, Shield, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

const pageTitles: Record<string, string> = {
  "/dashboard": "Home",
  "/metricas": "Dados e Métricas",
  "/relatorios": "Relatórios",
  "/financeiro": "Financeiro",
  "/notas-fiscais": "Notas Fiscais",
  "/calls": "Calls",
  "/educacao": "Educação",
  "/admin": "Admin",
  "/configuracoes/perfil": "Perfil",
  "/configuracoes/seguranca": "Segurança",
};

interface TopbarProps {
  userEmail?: string | null;
  userName?: string | null;
  clientName?: string | null;
  avatarUrl?: string | null;
}

export function Topbar({ userEmail, userName, clientName, avatarUrl }: TopbarProps) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const title =
    pageTitles[pathname] ??
    Object.entries(pageTitles).find(([k]) => pathname.startsWith(k + "/"))?.[1] ??
    "Portal";

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
        left: rect.right - 192,
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
      <header
        className="h-14 flex items-center justify-between px-6 border-b border-[var(--border)] bg-[var(--glass-strong)] backdrop-blur-md shadow-[0_2px_20px_rgb(0,0,0,0.04)] shrink-0 transition-colors duration-150"
      >
        <p className="text-[10px] font-medium tracking-[0.18em] uppercase select-none text-[var(--text-muted)]" style={{ opacity: 0.7 }}>
          {title}
        </p>

        <button
          ref={triggerRef}
          type="button"
          onClick={toggleMenu}
          className="flex items-center gap-2.5 pl-3 border-l border-[var(--border)] hover:opacity-80 transition-opacity cursor-pointer"
        >
          {displayName && (
            <div className="hidden sm:flex flex-col items-end gap-0.5 text-right">
              <div className="flex items-center gap-1">
                <p className="text-xs font-medium text-[var(--text-primary)] leading-none truncate max-w-[160px]">
                  {displayName}
                </p>
                <ChevronDown
                  size={11}
                  className={`text-[var(--text-muted)] transition-transform duration-150 ${open ? "rotate-180" : ""}`}
                  style={{ opacity: 0.5 }}
                />
              </div>
              {clientName && (
                <p className="text-[10px] font-light text-[var(--text-muted)] leading-none truncate max-w-[160px]" style={{ opacity: 0.7 }}>
                  {clientName}
                </p>
              )}
            </div>
          )}

          {/* Avatar */}
          <div className="w-8 h-8 rounded-full overflow-hidden bg-[var(--surface-soft)] border border-[var(--border)] flex items-center justify-center shrink-0 shadow-sm">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt="Avatar"
                width={32}
                height={32}
                className="w-full h-full object-cover"
              />
            ) : (
              <User size={14} className="text-vitti-blue/60" />
            )}
          </div>
        </button>
      </header>

      {open && menuStyle && (
        <div
          ref={menuRef}
          style={{ position: "fixed", top: menuStyle.top, left: menuStyle.left, zIndex: 99999 }}
          className="w-48 pointer-events-auto bg-[var(--surface-elevated)] border border-[var(--border)] rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.14)] py-1.5 overflow-hidden transition-colors duration-150"
        >
          {/* Contas */}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              window.location.assign("/selecionar-portal");
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-[var(--hover)] transition-colors"
          >
            <LayoutGrid size={13} className="text-vitti-blue/50 shrink-0" />
            <span className="text-[12px] font-light text-[var(--text-primary)]" style={{ opacity: 0.8 }}>Contas</span>
          </button>

          {/* Divisor */}
          <div className="border-t border-[var(--border)] my-1" />

          {/* Seção Configuração */}
          <p className="px-3 pt-1 pb-0.5 text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-widest select-none">
            Configuração
          </p>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              window.location.assign("/configuracoes/perfil");
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-[var(--hover)] transition-colors"
          >
            <UserCircle size={13} className="text-vitti-blue/50 shrink-0" />
            <span className="text-[12px] font-light text-[var(--text-primary)]" style={{ opacity: 0.8 }}>Perfil</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              window.location.assign("/configuracoes/seguranca");
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-[var(--hover)] transition-colors"
          >
            <Shield size={13} className="text-vitti-blue/50 shrink-0" />
            <span className="text-[12px] font-light text-[var(--text-primary)]" style={{ opacity: 0.8 }}>Segurança</span>
          </button>

          {/* Divisor */}
          <div className="border-t border-[var(--border)] my-1" />

          {/* Seção Aparência */}
          <p className="px-3 pt-1 pb-1.5 text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-widest select-none">
            Aparência
          </p>

          <div className="px-3 pb-2 flex items-center gap-1">
            <button
              type="button"
              onClick={() => setTheme("light")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-light transition-colors",
                mounted && theme === "light"
                  ? "bg-[var(--selected)] text-vitti-blue"
                  : "text-[var(--text-muted)] hover:bg-[var(--hover)]"
              )}
            >
              <Sun size={11} />
              Claro
            </button>
            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-light transition-colors",
                mounted && theme === "dark"
                  ? "bg-[var(--selected)] text-vitti-blue"
                  : "text-[var(--text-muted)] hover:bg-[var(--hover)]"
              )}
            >
              <Moon size={11} />
              Escuro
            </button>
          </div>
        </div>
      )}
    </>
  );
}

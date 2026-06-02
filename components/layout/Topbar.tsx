"use client";

import { usePathname } from "next/navigation";
import { Bell, User } from "lucide-react";

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
  const displaySub = clientName ?? userEmail;

  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-white bg-white/80 backdrop-blur-md shadow-[0_2px_20px_rgb(0,0,0,0.04)] shrink-0">
      <p className="text-[10px] font-medium tracking-[0.18em] uppercase select-none text-vitti-fg-muted/60">
        {title}
      </p>

      <div className="flex items-center gap-1.5">
        <button
          aria-label="Notificações"
          className="relative p-2 rounded-xl text-vitti-gray/50 hover:text-vitti-blue/70 hover:bg-slate-100/80 transition-colors duration-150"
        >
          <Bell size={15} />
          <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-vitti-light rounded-full" />
        </button>

        <div className="flex items-center gap-2.5 pl-3 ml-1 border-l border-slate-200/60">
          {displayName && (
            <div className="hidden sm:block text-right max-w-[180px]">
              <p
                className="text-xs font-medium text-vitti-fg leading-none truncate"
                title={userEmail ?? undefined}
              >
                {displayName}
              </p>
              {displaySub && (
                <p className="text-[10px] text-vitti-fg-muted/70 font-light mt-0.5 truncate">
                  {displaySub}
                </p>
              )}
            </div>
          )}
          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200/80 flex items-center justify-center shrink-0 shadow-sm">
            <User size={14} className="text-vitti-blue/60" />
          </div>
        </div>
      </div>
    </header>
  );
}

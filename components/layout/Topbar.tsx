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

  const displayName =
    userName ??
    (userEmail ? userEmail.split("@")[0] : null);

  const displaySub = clientName ?? userEmail;

  return (
    <header className="h-16 flex items-center justify-between px-6 border-b border-vitti-gray/[0.12] bg-white/90 backdrop-blur-md shrink-0">
      <p className="text-[11px] font-light text-vitti-blue/50 tracking-[0.2em] uppercase select-none">
        {title}
      </p>

      <div className="flex items-center gap-2">
        <button
          aria-label="Notificações"
          className="relative p-2 rounded-lg text-vitti-blue/40 hover:text-vitti-blue/70 hover:bg-vitti-gray/[0.08] transition-colors"
        >
          <Bell size={16} />
          <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-vitti-light rounded-full" />
        </button>

        <div className="flex items-center gap-2.5 pl-3 ml-1 border-l border-vitti-gray/[0.12]">
          {displayName && (
            <div className="hidden sm:block text-right max-w-[180px]">
              <p
                className="text-xs font-light text-vitti-blue leading-none truncate"
                title={userEmail ?? undefined}
              >
                {displayName}
              </p>
              {displaySub && (
                <p className="text-[10px] text-vitti-blue/50 font-light mt-0.5 truncate">
                  {displaySub}
                </p>
              )}
            </div>
          )}
          <div className="w-8 h-8 rounded-full bg-vitti-blue/20 border border-vitti-blue/30 flex items-center justify-center shrink-0">
            <User size={14} className="text-vitti-blue/70" />
          </div>
        </div>
      </div>
    </header>
  );
}

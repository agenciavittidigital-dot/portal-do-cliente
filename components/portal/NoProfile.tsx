"use client";

import { signOut } from "@/app/actions";
import { AlertCircle, RefreshCcw, ShieldOff } from "lucide-react";
import type { UserContextError } from "@/lib/data/user-context";

interface NoProfileProps {
  error?: UserContextError;
}

const config: Record<
  NonNullable<UserContextError>,
  { icon: React.ElementType; title: string; body: string; showReload: boolean }
> = {
  profile_not_found: {
    icon: AlertCircle,
    title: "Perfil não encontrado",
    body: "Seu perfil ainda não foi configurado. Entre em contato com a equipe Vitti Digital para liberar seu acesso.",
    showReload: false,
  },
  user_inactive: {
    icon: ShieldOff,
    title: "Acesso inativo",
    body: "Sua conta está inativa no momento. Entre em contato com a equipe Vitti Digital para reativar o acesso.",
    showReload: false,
  },
  load_error: {
    icon: AlertCircle,
    title: "Erro ao carregar dados",
    body: "Não foi possível carregar suas informações. Verifique sua conexão ou tente novamente em instantes.",
    showReload: true,
  },
};

export function NoProfile({ error = "profile_not_found" }: NoProfileProps) {
  const { icon: Icon, title, body, showReload } =
    config[error ?? "profile_not_found"];

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 text-center px-8">
      <div className="w-14 h-14 rounded-full bg-vitti-gray/[0.08] border border-vitti-gray/[0.14] flex items-center justify-center">
        <Icon size={22} className="text-vitti-blue/25" />
      </div>

      <div className="space-y-2 max-w-xs">
        <h3 className="text-sm font-light text-vitti-blue/70">{title}</h3>
        <p className="text-[12px] text-vitti-blue/45 font-light leading-relaxed">
          {body}
        </p>
      </div>

      <div className="flex flex-col items-center gap-3">
        {showReload && (
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 text-xs font-light text-vitti-blue/55 hover:text-vitti-blue transition-colors"
          >
            <RefreshCcw size={13} />
            Tentar novamente
          </button>
        )}
        <form action={signOut}>
          <button
            type="submit"
            className="text-[11px] font-light text-vitti-blue/40 hover:text-red-500/70 transition-colors underline underline-offset-4 decoration-vitti-blue/10"
          >
            Sair da conta
          </button>
        </form>
      </div>
    </div>
  );
}

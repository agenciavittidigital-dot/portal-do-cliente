"use client";

import { useActionState } from "react";
import { Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { changePassword } from "@/app/actions/configuracoes";
import type { ActionState } from "@/app/actions/configuracoes";

const INITIAL: ActionState = { error: null, success: false };

function PasswordField({
  id,
  name,
  label,
  placeholder,
  autoComplete,
}: {
  id: string;
  name: string;
  label: string;
  placeholder: string;
  autoComplete: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="text-[11px] font-medium text-vitti-fg-muted uppercase tracking-wide"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 pr-10 text-sm text-vitti-fg placeholder:text-vitti-fg-muted/40 focus:outline-none focus:ring-2 focus:ring-vitti-blue/20 focus:border-vitti-blue/50 transition-all"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setVisible((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-vitti-fg-muted/50 hover:text-vitti-fg-muted transition-colors"
        >
          {visible ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </div>
  );
}

export function SegurancaForm() {
  const [state, action, pending] = useActionState(changePassword, INITIAL);

  return (
    <div className="space-y-6 max-w-xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-vitti-fg">Segurança</h2>
        <p className="text-sm text-vitti-fg-muted mt-0.5">
          Altere sua senha de acesso ao portal
        </p>
      </div>

      {/* Card */}
      <form action={action}>
        <div className="rounded-2xl border border-white bg-white/60 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] p-6 space-y-5">
          {/* Ícone decorativo */}
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200/60 flex items-center justify-center shrink-0">
              <ShieldCheck size={14} className="text-vitti-light/60" />
            </div>
            <p className="text-sm font-medium text-vitti-fg">Alterar senha</p>
          </div>

          <PasswordField
            id="currentPassword"
            name="currentPassword"
            label="Senha atual"
            placeholder="••••••••"
            autoComplete="current-password"
          />

          <div className="border-t border-slate-100 pt-4 space-y-4">
            <PasswordField
              id="newPassword"
              name="newPassword"
              label="Nova senha"
              placeholder="Mínimo 6 caracteres"
              autoComplete="new-password"
            />

            <PasswordField
              id="confirmPassword"
              name="confirmPassword"
              label="Confirmar nova senha"
              placeholder="Repita a nova senha"
              autoComplete="new-password"
            />
          </div>

          {/* Requisitos */}
          <p className="text-[10px] text-vitti-fg-muted/60 font-light">
            A nova senha deve ter no mínimo 6 caracteres e ser diferente da senha atual.
          </p>

          {/* Feedback */}
          {state.error && (
            <div className="flex items-center gap-2 text-xs text-red-500">
              <AlertCircle size={12} />
              {state.error}
            </div>
          )}
          {state.success && !state.error && (
            <div className="flex items-center gap-2 text-xs text-emerald-600">
              <CheckCircle2 size={12} />
              Senha alterada com sucesso.
            </div>
          )}

          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-vitti-blue text-white text-sm font-medium hover:bg-vitti-blue/90 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {pending && <Loader2 size={13} className="animate-spin" />}
            Alterar senha
          </button>
        </div>
      </form>
    </div>
  );
}

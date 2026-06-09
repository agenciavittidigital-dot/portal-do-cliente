"use client";

import { useActionState, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { Eye, EyeOff, ArrowRight, AlertCircle, Loader2 } from "lucide-react";
import { signIn, type AuthState } from "./actions";

const initialState: AuthState = { error: null };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, initialState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="h-screen overflow-hidden flex flex-col lg:flex-row bg-black">
      {/* Left panel — 70% visual/institutional area */}
      <div
        className="hidden lg:block lg:w-[70%] relative"
        style={{
          backgroundImage: "url('/images/login/portal-parceiro-bg.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-[#171F38]/30 to-transparent" />
      </div>

      {/* Right panel — 30% login area */}
      <div className="flex-1 lg:w-[30%] flex items-center justify-center px-8 py-10 bg-[#050810]">
        <div className="w-full max-w-[320px]">
          <div className="mb-8">
            <Image
              src="/images/login/logo-vitti-icon-login.png"
              alt="Vitti"
              width={80}
              height={64}
              className="object-contain mb-2"
              priority
            />
            <h1 className="text-2xl font-bold text-white tracking-wide">
              Portal do Parceiro
            </h1>
            <p className="text-sm text-white/35 mt-2 font-light leading-relaxed">
              Acesse sua área exclusiva com<br />seus dados de login.
            </p>
          </div>

          <form action={formAction} className="space-y-4">
            {state.error && (
              <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-lg bg-red-500/8 border border-red-500/15">
                <AlertCircle size={14} className="text-red-400 shrink-0" />
                <p className="text-xs font-light text-red-300">{state.error}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="text-[10px] font-light text-white/40 uppercase tracking-[0.15em]"
              >
                E-mail
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="seu@email.com"
                autoComplete="email"
                required
                disabled={pending}
                className="w-full bg-white/[0.03] border border-white/8 rounded-lg px-4 py-3 text-sm text-white placeholder-white/15 font-light outline-none focus:border-[#455CAB]/60 focus:ring-1 focus:ring-[#455CAB]/20 transition-all disabled:opacity-50"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="text-[10px] font-light text-white/40 uppercase tracking-[0.15em]"
              >
                Senha
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  disabled={pending}
                  className="w-full bg-white/[0.03] border border-white/8 rounded-lg px-4 py-3 pr-11 text-sm text-white placeholder-white/15 font-light outline-none focus:border-[#455CAB]/60 focus:ring-1 focus:ring-[#455CAB]/20 transition-all disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-white/25 hover:text-white/50 transition-colors"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                size="lg"
                disabled={pending}
                className="w-full justify-between"
              >
                <span>{pending ? "Entrando..." : "Entrar"}</span>
                {pending ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <ArrowRight size={15} />
                )}
              </Button>
            </div>
          </form>

          <p className="text-center text-[11px] text-white/15 mt-10 font-light leading-relaxed">
            Problemas de acesso?
            <br />
            Entre em contato com a equipe Vitti.
          </p>
        </div>
      </div>
    </div>
  );
}

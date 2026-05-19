"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Eye, EyeOff, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="min-h-screen bg-vitti-black flex">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] p-12 bg-vitti-dark relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-to-br from-vitti-blue/8 via-transparent to-transparent" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-vitti-blue/8 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-20 right-0 w-px h-48 bg-gradient-to-b from-transparent via-vitti-light/20 to-transparent" />

        {/* Logo */}
        <div className="relative z-10">
          <span className="text-xl font-semibold text-white tracking-wide">
            vitti<span className="text-vitti-light">.</span>
          </span>
        </div>

        {/* Quote */}
        <div className="relative z-10 space-y-4">
          <p className="text-3xl font-light text-white/80 leading-relaxed tracking-wide">
            &ldquo;Dados claros,
            <br />
            decisões precisas.&rdquo;
          </p>
          <p className="text-sm text-white/25 font-light tracking-wide">
            Portal do Cliente — Vitti Digital
          </p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden mb-10">
            <span className="text-xl font-semibold text-white tracking-wide">
              vitti<span className="text-vitti-light">.</span>
            </span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-light text-white tracking-wide">
              Bem-vindo de volta
            </h1>
            <p className="text-sm text-white/30 mt-1.5 font-light">
              Entre com suas credenciais para continuar
            </p>
          </div>

          <form
            className="space-y-4"
            onSubmit={(e) => e.preventDefault()}
          >
            <div className="space-y-1.5">
              <label className="text-[10px] font-light text-white/40 uppercase tracking-[0.15em]">
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                autoComplete="email"
                className="w-full bg-white/[0.03] border border-white/8 rounded-lg px-4 py-3 text-sm text-white placeholder-white/15 font-light outline-none focus:border-vitti-blue/50 focus:ring-1 focus:ring-vitti-blue/15 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-light text-white/40 uppercase tracking-[0.15em]">
                Senha
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full bg-white/[0.03] border border-white/8 rounded-lg px-4 py-3 pr-11 text-sm text-white placeholder-white/15 font-light outline-none focus:border-vitti-blue/50 focus:ring-1 focus:ring-vitti-blue/15 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
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
                className="w-full justify-between"
              >
                <span>Entrar</span>
                <ArrowRight size={15} />
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

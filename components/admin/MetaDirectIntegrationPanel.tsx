"use client";

import { useState } from "react";
import {
  Target,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Eye,
  EyeOff,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MetaValidateApiResponse } from "@/app/api/admin/meta/validate/route";
import type { MetaSaveApiResponse } from "@/app/api/admin/meta/save/route";
import type { MetaIntegrationRow } from "@/lib/data/meta-integrations";
import type { Client } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface MetaDirectIntegrationPanelProps {
  clients: Client[];
  initialIntegrations: MetaIntegrationRow[];
}

type ValidationState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; accountName: string; accountStatus: string }
  | { status: "error"; message: string; errorCode: number | null };

type SaveState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; integrationId: string }
  | { status: "error"; message: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

function maskToken(last4: string | null): string {
  if (!last4) return "••••••••";
  return `••••••••${last4}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MetaDirectIntegrationPanel({
  clients,
  initialIntegrations,
}: MetaDirectIntegrationPanelProps) {
  // Formulário
  const [clientId, setClientId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);

  // Estado da validação
  const [validation, setValidation] = useState<ValidationState>({ status: "idle" });

  // Estado do salvamento
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });

  // Integrações salvas
  const [integrations, setIntegrations] = useState<MetaIntegrationRow[]>(initialIntegrations);

  // Quando o usuário altera qualquer campo, reseta validação e salvamento
  function handleFieldChange(cb: () => void) {
    cb();
    setValidation({ status: "idle" });
    setSaveState({ status: "idle" });
  }

  // ── Validar conexão ──────────────────────────────────────────────────────────

  async function handleValidate() {
    if (!accountId.trim() || !token.trim()) return;

    setValidation({ status: "loading" });
    setSaveState({ status: "idle" });

    try {
      const res = await fetch("/api/admin/meta/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: accountId.trim(),
          token: token.trim(),
        }),
      });

      const json: MetaValidateApiResponse = await res.json();

      if (!json.success || !json.account) {
        setValidation({
          status: "error",
          message:
            json.error ?? "Falha ao validar. Verifique o token e o ID da conta.",
          errorCode: json.errorCode ?? null,
        });
        return;
      }

      setValidation({
        status: "success",
        accountName: json.account.account_name,
        accountStatus: json.account.account_status_label,
      });
    } catch {
      setValidation({
        status: "error",
        message: "Falha de conexão. Tente novamente.",
        errorCode: null,
      });
    }
  }

  // ── Salvar integração ────────────────────────────────────────────────────────

  async function handleSave() {
    if (validation.status !== "success") return;
    if (!clientId || !accountId.trim() || !token.trim()) return;

    setSaveState({ status: "loading" });

    try {
      const res = await fetch("/api/admin/meta/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          accountId: accountId.trim(),
          accountName: validation.accountName,
          token: token.trim(),
        }),
      });

      const json: MetaSaveApiResponse = await res.json();

      if (!json.success || !json.integrationId) {
        setSaveState({
          status: "error",
          message: json.error ?? "Erro ao salvar integração.",
        });
        return;
      }

      setSaveState({ status: "success", integrationId: json.integrationId });

      // Limpa o campo de token imediatamente após salvar — nunca fica no DOM
      setToken("");
      setAccountId("");
      setClientId("");
      setValidation({ status: "idle" });

      // Recarrega a lista de integrações
      const listRes = await fetch("/api/admin/meta/integrations");
      const listJson = await listRes.json();
      if (listJson.success && listJson.integrations) {
        setIntegrations(listJson.integrations);
      }
    } catch {
      setSaveState({
        status: "error",
        message: "Falha de conexão. Tente novamente.",
      });
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const canValidate =
    accountId.trim().length > 0 &&
    token.trim().length > 0 &&
    validation.status !== "loading";

  const canSave =
    validation.status === "success" &&
    clientId.length > 0 &&
    saveState.status !== "loading" &&
    saveState.status !== "success";

  return (
    <div className="rounded-xl border border-black/[0.07] bg-black/[0.02] divide-y divide-black/[0.04]">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-4 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-vitti-blue/[0.08] border border-vitti-blue/20 flex items-center justify-center shrink-0">
            <Target size={14} className="text-vitti-light/70" />
          </div>
          <div>
            <p className="text-xs font-light text-[#111111]/80">Meta Ads — Integração Direta</p>
            <p className="text-[10px] font-light text-[#5F6368]/55 mt-0.5">
              Token por cliente · Armazenamento criptografado (AES-256-GCM)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <ShieldCheck size={11} className="text-emerald-400/40" />
          <span className="text-[9px] font-light text-emerald-400/50">
            Token nunca exposto ao frontend
          </span>
        </div>
      </div>

      {/* ── Formulário ─────────────────────────────────────────────── */}
      <div className="px-5 py-5 space-y-4">

        <p className="text-[9px] text-[#5F6368]/45 uppercase tracking-[0.18em] font-light">
          Nova integração
        </p>

        {/* Cliente */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-light text-[#5F6368]/65">
            Cliente
          </label>
          <select
            value={clientId}
            onChange={(e) => handleFieldChange(() => setClientId(e.target.value))}
            className="w-full bg-black/[0.04] border border-black/[0.08] rounded-lg px-3 py-2 text-[11px] text-[#5F6368]/80 font-light focus:outline-none focus:border-vitti-blue/40 transition-colors appearance-none"
          >
            <option value="">Selecione um cliente...</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Account ID */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-light text-[#5F6368]/65">
            ID da conta de anúncios
          </label>
          <input
            type="text"
            value={accountId}
            onChange={(e) => handleFieldChange(() => setAccountId(e.target.value))}
            placeholder="4602151306731510 ou act_4602151306731510"
            autoComplete="off"
            spellCheck={false}
            className="w-full bg-black/[0.04] border border-black/[0.08] rounded-lg px-3 py-2 text-[11px] text-[#5F6368]/80 font-light font-mono focus:outline-none focus:border-vitti-blue/40 transition-colors placeholder:text-[#5F6368]/30"
          />
          <p className="text-[9px] font-light text-[#5F6368]/40">
            Aceita com ou sem prefixo <span className="font-mono">act_</span>
          </p>
        </div>

        {/* Token */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-light text-[#5F6368]/65">
            Token de acesso
          </label>
          <div className="relative">
            <input
              type={showToken ? "text" : "password"}
              value={token}
              onChange={(e) => handleFieldChange(() => setToken(e.target.value))}
              placeholder="EAA..."
              autoComplete="new-password"
              spellCheck={false}
              className="w-full bg-black/[0.04] border border-black/[0.08] rounded-lg px-3 py-2 pr-9 text-[11px] text-[#5F6368]/80 font-light font-mono focus:outline-none focus:border-vitti-blue/40 transition-colors placeholder:text-[#5F6368]/30"
            />
            <button
              type="button"
              onClick={() => setShowToken((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#5F6368]/40 hover:text-[#5F6368]/70 transition-colors"
              tabIndex={-1}
            >
              {showToken ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
          <p className="text-[9px] font-light text-[#5F6368]/40">
            System User token do Meta Business Manager com escopo{" "}
            <span className="font-mono">ads_read</span>
          </p>
        </div>

        {/* Botão testar */}
        <button
          onClick={handleValidate}
          disabled={!canValidate}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2 rounded-full border text-[11px] font-light transition-all duration-150 select-none",
            canValidate
              ? "border-vitti-blue/30 text-vitti-light/80 bg-vitti-blue/[0.10] hover:bg-vitti-blue/[0.16] cursor-pointer"
              : "border-black/[0.08] text-[#5F6368]/40 cursor-not-allowed"
          )}
        >
          {validation.status === "loading" ? (
            <RefreshCw size={11} className="animate-spin shrink-0" />
          ) : (
            <Target size={11} className="shrink-0" />
          )}
          {validation.status === "loading" ? "Testando..." : "Testar conexão"}
        </button>

        {/* Resultado da validação */}
        {validation.status === "success" && (
          <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.03] px-4 py-3 space-y-1">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={12} className="text-emerald-400/60 shrink-0" />
              <p className="text-[11px] font-light text-emerald-400/70">
                Conectado com sucesso
              </p>
            </div>
            <p className="text-[10px] font-light text-[#5F6368]/60 pl-5">
              Conta:{" "}
              <span className="text-[#111111]/65">{validation.accountName}</span>
            </p>
            <p className="text-[10px] font-light text-[#5F6368]/60 pl-5">
              Status:{" "}
              <span className="text-[#111111]/65">{validation.accountStatus}</span>
            </p>
          </div>
        )}

        {validation.status === "error" && (
          <div className="rounded-xl border border-red-500/15 bg-red-500/[0.03] px-4 py-3 space-y-1">
            <div className="flex items-center gap-2">
              <XCircle size={12} className="text-red-400/60 shrink-0" />
              <p className="text-[11px] font-light text-red-400/60">
                Falha na validação
              </p>
            </div>
            <p className="text-[10px] font-light text-[#5F6368]/55 pl-5 leading-relaxed">
              {validation.message}
              {validation.errorCode !== null && (
                <span className="font-mono text-[9px] ml-1 text-[#5F6368]/40">
                  (código {validation.errorCode})
                </span>
              )}
            </p>
          </div>
        )}

        {/* Botão salvar — habilitado só após validação bem-sucedida */}
        {validation.status === "success" && (
          <div className="pt-1">
            {!clientId && (
              <p className="text-[10px] font-light text-amber-400/50 mb-2">
                Selecione um cliente antes de salvar.
              </p>
            )}
            <button
              onClick={handleSave}
              disabled={!canSave}
              className={cn(
                "flex items-center gap-1.5 px-5 py-2 rounded-full border text-[11px] font-light transition-all duration-150 select-none",
                canSave
                  ? "border-vitti-blue/40 text-white/80 bg-vitti-blue/80 hover:bg-vitti-blue/90 cursor-pointer"
                  : "border-black/[0.08] text-[#5F6368]/40 cursor-not-allowed"
              )}
            >
              {saveState.status === "loading" ? (
                <RefreshCw size={11} className="animate-spin shrink-0" />
              ) : (
                <ShieldCheck size={11} className="shrink-0" />
              )}
              {saveState.status === "loading" ? "Salvando..." : "Salvar integração"}
            </button>

            {saveState.status === "error" && (
              <p className="text-[10px] font-light text-red-400/60 mt-2">
                {saveState.message}
              </p>
            )}
          </div>
        )}

        {saveState.status === "success" && (
          <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.03] px-4 py-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={12} className="text-emerald-400/60 shrink-0" />
              <p className="text-[11px] font-light text-emerald-400/70">
                Integração salva com sucesso. Token criptografado armazenado.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Integrações salvas ──────────────────────────────────────── */}
      {integrations.length > 0 && (
        <div className="px-5 py-4 space-y-3">
          <p className="text-[9px] text-[#5F6368]/45 uppercase tracking-[0.18em] font-light">
            Integrações configuradas
          </p>

          {integrations.map((row) => {
            const clientName =
              clients.find((c) => c.id === row.client_id)?.name ?? row.client_id;

            return (
              <div
                key={row.id}
                className="rounded-xl border border-black/[0.06] bg-black/[0.02] px-4 py-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 size={12} className="text-emerald-400/50 shrink-0" />
                    <div>
                      <p className="text-[11px] font-light text-[#111111]/80">
                        {clientName}
                      </p>
                      <p className="text-[9px] font-light text-[#5F6368]/50 font-mono">
                        act_{row.account_id}
                      </p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "text-[9px] font-light px-2 py-0.5 rounded-full border",
                      row.token_status === "valid"
                        ? "text-emerald-400/60 border-emerald-400/20 bg-emerald-400/[0.05]"
                        : "text-amber-400/60 border-amber-400/20 bg-amber-400/[0.05]"
                    )}
                  >
                    {row.token_status === "valid" ? "Conectado" : (row.token_status ?? "Desconhecido")}
                  </span>
                </div>

                <div className="space-y-0.5 pl-[22px]">
                  <p className="text-[9px] font-light text-[#5F6368]/45 font-mono">
                    Token: {maskToken(row.token_last4)}
                  </p>
                  <p className="text-[9px] font-light text-[#5F6368]/40">
                    Conta: {row.account_name}
                  </p>
                  <p className="text-[9px] font-light text-[#5F6368]/40">
                    Validado: {formatDate(row.last_validated_at)}
                  </p>
                </div>

                {/* Substituir token — abre formulário para o mesmo cliente */}
                <div className="pl-[22px] pt-1">
                  <button
                    onClick={() => {
                      setClientId(row.client_id);
                      setAccountId(row.account_id);
                      setToken("");
                      setValidation({ status: "idle" });
                      setSaveState({ status: "idle" });
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="text-[9px] font-light text-vitti-light/50 hover:text-vitti-light/80 transition-colors underline underline-offset-2"
                  >
                    Substituir token
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {integrations.length === 0 && (
        <div className="px-5 py-4">
          <p className="text-[10px] font-light text-[#5F6368]/40 text-center py-2">
            Nenhuma integração Meta Direct configurada ainda.
          </p>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Link2, RefreshCw, AlertTriangle, CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WindsorAccountRow, WindsorAccountsApiResponse } from "@/app/api/admin/windsor/accounts/route";
import type { MappingApiResponse } from "@/app/api/admin/windsor/mappings/route";

interface ActiveClient {
  id: string;
  name: string;
}

interface WindsorAccountMappingProps {
  clients: ActiveClient[];
}

interface AccountState {
  row: WindsorAccountRow;
  selectedClientId: string;
  saving: boolean;
  saved: boolean;
  saveError: string | null;
}

export function WindsorAccountMapping({ clients }: WindsorAccountMappingProps) {
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [accountStates, setAccountStates] = useState<AccountState[]>([]);
  const [discovered, setDiscovered] = useState(false);

  async function handleDiscover() {
    setLoading(true);
    setFetchError(null);

    try {
      const res = await fetch("/api/admin/windsor/accounts");
      const json: WindsorAccountsApiResponse = await res.json();

      if (!json.success) {
        setFetchError(json.error ?? "Erro ao descobrir contas Windsor.");
        return;
      }

      setAccountStates(
        json.accounts.map((row) => ({
          row,
          selectedClientId: row.clientId ?? "",
          saving: false,
          saved: false,
          saveError: null,
        }))
      );
      setDiscovered(true);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Falha na requisição.");
    } finally {
      setLoading(false);
    }
  }

  function setAccountField(
    index: number,
    patch: Partial<AccountState>
  ) {
    setAccountStates((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...patch } : s))
    );
  }

  async function handleSave(index: number) {
    const state = accountStates[index];
    if (!state.selectedClientId) return;

    setAccountField(index, { saving: true, saveError: null, saved: false });

    try {
      const res = await fetch("/api/admin/windsor/mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: state.selectedClientId,
          accountName: state.row.accountName,
          accountId: state.row.accountId ?? null,
        }),
      });

      const json: MappingApiResponse = await res.json();

      if (!json.success) {
        const msg = json.detail
          ? `${json.error ?? "Erro ao salvar."} — ${json.detail}`
          : (json.error ?? "Erro ao salvar.");
        setAccountField(index, { saving: false, saveError: msg });
        return;
      }

      const clientName = clients.find((c) => c.id === state.selectedClientId)?.name ?? null;

      setAccountField(index, {
        saving: false,
        saved: true,
        row: {
          ...state.row,
          mapped: true,
          clientId: state.selectedClientId,
          clientName,
        },
      });
    } catch (e) {
      setAccountField(index, {
        saving: false,
        saveError: e instanceof Error ? e.message : "Falha na requisição.",
      });
    }
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] divide-y divide-white/[0.04]">

      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-4 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center shrink-0">
            <Link2 size={14} className="text-vitti-light/30" />
          </div>
          <div>
            <p className="text-xs font-light text-white/65">Mapeamento de Contas Windsor</p>
            <p className="text-[10px] font-light text-white/25 mt-0.5">
              Associe cada conta de anúncio a um cliente do portal
            </p>
          </div>
        </div>
        <button
          onClick={handleDiscover}
          disabled={loading}
          className={cn(
            "flex items-center gap-1.5 px-4 py-1.5 rounded-full border text-[11px] font-light transition-all duration-150 select-none",
            loading
              ? "border-white/[0.07] text-white/20 cursor-not-allowed"
              : "border-vitti-blue/30 text-vitti-light/80 bg-vitti-blue/[0.10] hover:bg-vitti-blue/[0.16] cursor-pointer"
          )}
        >
          <RefreshCw size={10} className={cn("shrink-0", loading && "animate-spin")} />
          {loading ? "Descobrindo..." : discovered ? "Atualizar contas" : "Descobrir contas Windsor"}
        </button>
      </div>

      {/* ── Aviso ─────────────────────────────────────────────────── */}
      <div className="px-5 py-3">
        <div className="flex items-start gap-2 rounded-lg border border-amber-400/[0.12] bg-amber-400/[0.03] px-3.5 py-2.5">
          <AlertTriangle size={11} className="text-amber-400/45 shrink-0 mt-0.5" />
          <p className="text-[10px] font-light text-amber-400/50 leading-relaxed">
            Mapeamento obrigatório antes da sincronização. Cada conta Windsor deve estar associada a
            um cliente para que os dados sejam gravados corretamente em{" "}
            <span className="font-mono text-[9px]">performance_daily</span>.
          </p>
        </div>
      </div>

      {/* ── Conteúdo ──────────────────────────────────────────────── */}
      <div className="px-5 py-4 space-y-3">
        {/* Erro na descoberta */}
        {fetchError && (
          <div className="flex items-start gap-2.5 rounded-xl border border-red-500/15 bg-red-500/[0.04] px-4 py-3">
            <p className="text-[11px] font-light text-red-400/60 leading-relaxed">{fetchError}</p>
          </div>
        )}

        {/* Estado vazio — ainda não descobriu */}
        {!discovered && !fetchError && (
          <p className="text-[11px] font-light text-white/[0.18] text-center py-4">
            Clique em &quot;Descobrir contas Windsor&quot; para listar as contas ativas.
          </p>
        )}

        {/* Descoberta sem resultados */}
        {discovered && accountStates.length === 0 && (
          <p className="text-[11px] font-light text-white/[0.18] text-center py-4">
            Nenhuma conta encontrada na Windsor para o período atual.
          </p>
        )}

        {/* Lista de contas */}
        {accountStates.length > 0 && (
          <div className="space-y-2">
            <p className="text-[9px] text-white/[0.15] uppercase tracking-[0.15em] font-light">
              {accountStates.length} conta{accountStates.length !== 1 ? "s" : ""} detectada
              {accountStates.length !== 1 ? "s" : ""}
            </p>

            {accountStates.map((state, i) => (
              <div
                key={state.row.accountName}
                className="rounded-xl border border-white/[0.05] bg-white/[0.01] px-4 py-3 space-y-2.5"
              >
                {/* Nome + status */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    {state.row.mapped || state.saved ? (
                      <CheckCircle2 size={12} className="text-emerald-400/50 shrink-0" />
                    ) : (
                      <Circle size={12} className="text-white/15 shrink-0" />
                    )}
                    <div>
                      <p className="text-[11px] font-light text-white/70">{state.row.accountName}</p>
                      {state.row.accountId && (
                        <p className="text-[9px] font-light text-white/20 font-mono">
                          {state.row.accountId}
                        </p>
                      )}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "text-[9px] font-light px-2 py-0.5 rounded-full border",
                      state.row.mapped || state.saved
                        ? "text-emerald-400/60 border-emerald-400/20 bg-emerald-400/[0.05]"
                        : "text-white/25 border-white/[0.08] bg-white/[0.02]"
                    )}
                  >
                    {state.row.mapped || state.saved ? "Mapeada" : "Não mapeada"}
                  </span>
                </div>

                {/* Selector + botão salvar */}
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={state.selectedClientId}
                    onChange={(e) => setAccountField(i, { selectedClientId: e.target.value, saved: false })}
                    disabled={state.saving}
                    className="flex-1 min-w-0 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-[11px] text-white/50 font-light focus:outline-none focus:border-vitti-blue/40 transition-colors appearance-none"
                  >
                    <option value="">Selecione um cliente...</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleSave(i)}
                    disabled={!state.selectedClientId || state.saving}
                    className={cn(
                      "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-[10px] font-light transition-all duration-150 select-none shrink-0",
                      !state.selectedClientId || state.saving
                        ? "border-white/[0.07] text-white/20 cursor-not-allowed"
                        : "border-vitti-blue/30 text-vitti-light/80 bg-vitti-blue/[0.10] hover:bg-vitti-blue/[0.16] cursor-pointer"
                    )}
                  >
                    {state.saving ? (
                      <RefreshCw size={9} className="animate-spin" />
                    ) : null}
                    {state.saving ? "Salvando..." : "Salvar mapeamento"}
                  </button>
                </div>

                {/* Feedback */}
                {state.saved && (
                  <p className="text-[10px] font-light text-emerald-400/50">
                    Mapeamento salvo com sucesso.
                  </p>
                )}
                {state.saveError && (
                  <p className="text-[10px] font-light text-red-400/60">{state.saveError}</p>
                )}
                {(state.row.mapped || state.saved) && state.row.clientName && !state.saved && (
                  <p className="text-[10px] font-light text-white/25">
                    Mapeada para: <span className="text-white/45">{state.row.clientName}</span>
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import {
  Search,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from "lucide-react";
import type { GoogleAdsTestApiResponse } from "@/app/api/admin/windsor/google-ads-test/route";
import type { GoogleAdsAccountsApiResponse } from "@/app/api/admin/windsor/google-ads-accounts/route";
import type { GoogleAdsMappingApiResponse } from "@/app/api/admin/windsor/google-ads-mappings/route";
import type { GoogleAdsSyncApiResponse } from "@/app/api/admin/windsor/google-ads-sync/route";
interface ActiveClient {
  id: string;
  name: string;
}

// ── Seção: Diagnóstico ─────────────────────────────────────────────────────────

function DiagnosticSection() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GoogleAdsTestApiResponse["result"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSample, setShowSample] = useState(false);

  async function runTest() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/windsor/google-ads-test");
      const json = (await res.json()) as GoogleAdsTestApiResponse;
      if (!json.success || !json.result) {
        setError(json.error ?? "Erro desconhecido.");
      } else {
        setResult(json.result);
      }
    } catch {
      setError("Erro de rede.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <p className="text-xs font-light text-white/50">Diagnóstico — Google Ads</p>
        <button
          onClick={runTest}
          disabled={loading}
          className="flex items-center gap-1.5 text-[9px] font-light px-3 py-1.5 rounded-full border border-white/[0.08] text-white/40 hover:text-white/70 hover:border-white/[0.15] transition-all disabled:opacity-50"
        >
          {loading ? <Loader2 size={10} className="animate-spin" /> : <Search size={10} />}
          Testar Google Ads
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-[11px] text-red-400/70 bg-red-400/5 border border-red-400/15 rounded-lg px-3 py-2">
          <AlertCircle size={12} className="shrink-0" />
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-3">
          {/* Summary chips */}
          <div className="flex flex-wrap gap-2">
            <span className="text-[9px] font-light px-2.5 py-1 rounded-full border border-white/[0.07] text-white/40">
              {result.googleAdsRecords} registros Google Ads
            </span>
            <span className="text-[9px] font-light px-2.5 py-1 rounded-full border border-emerald-400/20 text-emerald-400/60">
              {result.fieldsAccepted.length} campos aceitos
            </span>
            {result.fieldsRejected.length > 0 && (
              <span className="text-[9px] font-light px-2.5 py-1 rounded-full border border-amber-400/20 text-amber-400/60">
                {result.fieldsRejected.length} campos rejeitados
              </span>
            )}
          </div>

          {/* Datasources encontrados */}
          {result.allDatasources.length > 0 && (
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg px-3 py-2.5 space-y-1.5">
              <p className="text-[9px] text-white/25 font-light uppercase tracking-widest">
                Datasources Windsor encontrados
              </p>
              <div className="flex flex-wrap gap-1.5">
                {result.allDatasources.map((ds) => (
                  <span
                    key={ds}
                    className="text-[9px] font-mono px-2 py-0.5 rounded border border-white/[0.07] text-white/50"
                  >
                    {ds}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Contas Google Ads */}
          {result.googleAdsAccounts.length > 0 ? (
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg px-3 py-2.5 space-y-1.5">
              <p className="text-[9px] text-white/25 font-light uppercase tracking-widest">
                Contas Google Ads detectadas
              </p>
              <div className="space-y-1">
                {result.googleAdsAccounts.map((acc) => (
                  <p key={acc} className="text-[10px] font-light text-white/60">
                    {acc}
                  </p>
                ))}
              </div>
            </div>
          ) : result.googleAdsRecords === 0 ? (
            <div className="text-[11px] text-amber-400/60 font-light">
              Nenhum registro Google Ads encontrado. Verifique se há uma conta Google Ads conectada
              na Windsor com datasource contendo &ldquo;google&rdquo;.
            </div>
          ) : null}

          {/* Campos aceitos/rejeitados */}
          <div className="grid grid-cols-2 gap-2">
            {result.fieldsAccepted.length > 0 && (
              <div className="bg-emerald-400/[0.03] border border-emerald-400/15 rounded-lg px-3 py-2.5 space-y-1">
                <p className="text-[9px] text-emerald-400/50 uppercase tracking-widest font-light">
                  Aceitos
                </p>
                {result.fieldsAccepted.map((f) => (
                  <p key={f} className="text-[9px] font-mono text-white/50">
                    {f}
                  </p>
                ))}
              </div>
            )}
            {result.fieldsRejected.length > 0 && (
              <div className="bg-amber-400/[0.03] border border-amber-400/15 rounded-lg px-3 py-2.5 space-y-1">
                <p className="text-[9px] text-amber-400/50 uppercase tracking-widest font-light">
                  Rejeitados
                </p>
                {result.fieldsRejected.map((f) => (
                  <p key={f} className="text-[9px] font-mono text-white/50">
                    {f}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Amostra */}
          {result.sampleRecords.length > 0 && (
            <div>
              <button
                onClick={() => setShowSample((s) => !s)}
                className="flex items-center gap-1 text-[9px] text-white/30 hover:text-white/60 transition-colors"
              >
                {showSample ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                {showSample ? "Ocultar" : "Ver"} amostra ({result.sampleRecords.length} registros)
              </button>
              {showSample && (
                <pre className="mt-2 text-[9px] font-mono text-white/40 bg-white/[0.02] border border-white/[0.05] rounded-lg p-3 overflow-x-auto max-h-48">
                  {JSON.stringify(result.sampleRecords, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Seção: Mapeamento de Contas ────────────────────────────────────────────────

function AccountMappingSection({ clients }: { clients: ActiveClient[] }) {
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [accounts, setAccounts] = useState<GoogleAdsAccountsApiResponse["accounts"]>([]);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [savingFor, setSavingFor] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<Record<string, string>>({});
  const [savedFor, setSavedFor] = useState<Set<string>>(new Set());
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({});

  async function discoverAccounts() {
    setLoadingAccounts(true);
    setAccountError(null);
    try {
      const res = await fetch("/api/admin/windsor/google-ads-accounts");
      const json = (await res.json()) as GoogleAdsAccountsApiResponse;
      if (!json.success) {
        setAccountError(json.error ?? "Erro ao descobrir contas.");
      } else {
        setAccounts(json.accounts);
        const initial: Record<string, string> = {};
        for (const acc of json.accounts) {
          if (acc.clientId) initial[acc.accountName] = acc.clientId;
        }
        setSelectedClient(initial);
      }
    } catch {
      setAccountError("Erro de rede.");
    } finally {
      setLoadingAccounts(false);
    }
  }

  async function saveMapping(accountName: string) {
    const clientId = selectedClient[accountName];
    if (!clientId) return;

    setSavingFor(accountName);
    setSaveErrors((prev) => ({ ...prev, [accountName]: "" }));

    try {
      const res = await fetch("/api/admin/windsor/google-ads-mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, accountName }),
      });
      const json = (await res.json()) as GoogleAdsMappingApiResponse;
      if (!json.success) {
        setSaveErrors((prev) => ({
          ...prev,
          [accountName]: json.error ?? "Erro ao salvar.",
        }));
      } else {
        setSavedFor((prev) => new Set([...prev, accountName]));
      }
    } catch {
      setSaveErrors((prev) => ({ ...prev, [accountName]: "Erro de rede." }));
    } finally {
      setSavingFor(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <p className="text-xs font-light text-white/50">Mapeamento — Contas Google Ads</p>
        <button
          onClick={discoverAccounts}
          disabled={loadingAccounts}
          className="flex items-center gap-1.5 text-[9px] font-light px-3 py-1.5 rounded-full border border-white/[0.08] text-white/40 hover:text-white/70 hover:border-white/[0.15] transition-all disabled:opacity-50"
        >
          {loadingAccounts ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
          Descobrir contas
        </button>
      </div>

      {accountError && (
        <div className="flex items-center gap-2 text-[11px] text-red-400/70 bg-red-400/5 border border-red-400/15 rounded-lg px-3 py-2">
          <AlertCircle size={12} className="shrink-0" />
          {accountError}
        </div>
      )}

      {accounts.length > 0 && (
        <div className="space-y-2">
          {accounts.map((acc) => (
            <div
              key={acc.accountName}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-white/[0.05] bg-white/[0.01]"
            >
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-light text-white/70 truncate">{acc.accountName}</p>
                {acc.mapped && acc.clientName && (
                  <p className="text-[9px] text-emerald-400/50 font-light">
                    Mapeado → {acc.clientName}
                  </p>
                )}
                {saveErrors[acc.accountName] && (
                  <p className="text-[9px] text-red-400/60 font-light">
                    {saveErrors[acc.accountName]}
                  </p>
                )}
              </div>

              <select
                value={selectedClient[acc.accountName] ?? ""}
                onChange={(e) =>
                  setSelectedClient((prev) => ({ ...prev, [acc.accountName]: e.target.value }))
                }
                className="bg-white/[0.03] border border-white/[0.07] rounded-lg px-2 py-1.5 text-[9px] font-light text-white/60 focus:outline-none min-w-[140px]"
              >
                <option value="" className="bg-[#0d1117]">
                  Selecionar cliente...
                </option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id} className="bg-[#0d1117]">
                    {c.name}
                  </option>
                ))}
              </select>

              <button
                onClick={() => saveMapping(acc.accountName)}
                disabled={savingFor === acc.accountName || !selectedClient[acc.accountName]}
                className="flex items-center gap-1 text-[9px] font-light px-2.5 py-1.5 rounded-full border border-vitti-medium/30 text-vitti-light/60 hover:border-vitti-medium/60 hover:text-vitti-light/90 transition-all disabled:opacity-40"
              >
                {savingFor === acc.accountName ? (
                  <Loader2 size={9} className="animate-spin" />
                ) : savedFor.has(acc.accountName) ? (
                  <CheckCircle2 size={9} className="text-emerald-400/70" />
                ) : null}
                {savedFor.has(acc.accountName) ? "Salvo" : "Salvar"}
              </button>
            </div>
          ))}
        </div>
      )}

      {accounts.length === 0 && !loadingAccounts && !accountError && (
        <p className="text-[11px] text-white/20 font-light">
          Clique em &ldquo;Descobrir contas&rdquo; para listar as contas Google Ads disponíveis.
        </p>
      )}
    </div>
  );
}

// ── Seção: Sincronização ───────────────────────────────────────────────────────

function SyncSection() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GoogleAdsSyncApiResponse["result"] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runSync() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/windsor/google-ads-sync", { method: "POST" });
      const json = (await res.json()) as GoogleAdsSyncApiResponse;
      if (!json.success || !json.result) {
        setError(json.error ?? "Erro desconhecido.");
      } else {
        setResult(json.result);
      }
    } catch {
      setError("Erro de rede.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <p className="text-xs font-light text-white/50">Sincronização — Google Ads</p>
        <button
          onClick={runSync}
          disabled={loading}
          className="flex items-center gap-1.5 text-[9px] font-light px-3 py-1.5 rounded-full border border-vitti-medium/30 text-vitti-light/60 hover:border-vitti-medium/60 hover:text-vitti-light/90 transition-all disabled:opacity-50"
        >
          {loading ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
          Sincronizar dados Google Ads
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-[11px] text-red-400/70 bg-red-400/5 border border-red-400/15 rounded-lg px-3 py-2">
          <AlertCircle size={12} className="shrink-0" />
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-3">
          {/* Status */}
          <div className="flex items-center gap-2">
            {result.success && result.upserted > 0 ? (
              <CheckCircle2 size={13} className="text-emerald-400/70" />
            ) : (
              <AlertCircle size={13} className="text-amber-400/60" />
            )}
            <span className="text-[11px] font-light text-white/60">
              {result.upserted > 0
                ? `${result.upserted} registros gravados em performance_daily (channel = google_ads)`
                : "Nenhum registro gravado — verifique mapeamentos acima."}
            </span>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Total Windsor", value: result.totalFetched },
              { label: "Google Ads", value: result.googleAdsRecords },
              { label: "Mapeados", value: result.mappedRecords },
              { label: "Agrupados", value: result.groupedRecords },
              { label: "Ignorados", value: result.skippedUnmapped },
              { label: "Gravados", value: result.upserted },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="bg-white/[0.02] border border-white/[0.05] rounded-lg px-2.5 py-2"
              >
                <p className="text-[9px] text-white/25 font-light">{label}</p>
                <p className="text-base font-light text-white/70 mt-0.5">{value}</p>
              </div>
            ))}
          </div>

          {/* Campos sincronizados */}
          {result.fieldsSynced.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {result.fieldsSynced.map((f) => (
                <span key={f} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/[0.03] border border-white/[0.05] text-white/30">
                  {f}
                </span>
              ))}
            </div>
          )}

          {/* Contas sem mapeamento */}
          {result.unmappedAccounts.length > 0 && (
            <div className="bg-amber-400/[0.03] border border-amber-400/15 rounded-lg px-3 py-2">
              <p className="text-[9px] text-amber-400/50 font-light mb-1">
                Contas Google Ads sem mapeamento:
              </p>
              {result.unmappedAccounts.map((a) => (
                <p key={a} className="text-[9px] font-mono text-white/40">
                  {a}
                </p>
              ))}
            </div>
          )}

          {/* Amostra */}
          {result.sampleSaved.length > 0 && (
            <div className="border border-white/[0.05] rounded-lg overflow-hidden">
              <table className="w-full text-[9px] font-light">
                <thead>
                  <tr className="border-b border-white/[0.05] bg-white/[0.02]">
                    {["Data", "Conta", "Campanha", "Invest.", "Cliques", "Impress.", "Conversões"].map((h) => (
                      <th key={h} className="text-left px-3 py-2 text-white/25 font-light">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.sampleSaved.map((row, i) => (
                    <tr key={i} className="border-b border-white/[0.03]">
                      <td className="px-3 py-2 text-white/50">{row.date}</td>
                      <td className="px-3 py-2 text-white/50 max-w-[80px] truncate">{row.accountName}</td>
                      <td className="px-3 py-2 text-white/40 max-w-[100px] truncate">{row.campaignName ?? "—"}</td>
                      <td className="px-3 py-2 text-white/50">R$ {row.spend.toFixed(2)}</td>
                      <td className="px-3 py-2 text-white/50">{row.clicks}</td>
                      <td className="px-3 py-2 text-white/50">{row.impressions}</td>
                      <td className="px-3 py-2 text-white/50">{row.conversions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Painel principal ───────────────────────────────────────────────────────────

export function WindsorGoogleAdsPanel({ clients }: { clients: ActiveClient[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.01]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center shrink-0">
            <Search size={14} className="text-vitti-light/40" />
          </div>
          <div className="text-left">
            <p className="text-xs font-light text-white/65">Google Ads — Windsor AI</p>
            <p className="text-[10px] font-light text-white/25 mt-0.5">
              Diagnóstico, mapeamento e sincronização de dados Google Ads
            </p>
          </div>
        </div>
        {open ? (
          <ChevronUp size={13} className="text-white/25 shrink-0" />
        ) : (
          <ChevronDown size={13} className="text-white/25 shrink-0" />
        )}
      </button>

      {open && (
        <div className="border-t border-white/[0.05] px-5 py-4 space-y-6">
          <DiagnosticSection />
          <div className="border-t border-white/[0.04]" />
          <AccountMappingSection clients={clients} />
          <div className="border-t border-white/[0.04]" />
          <SyncSection />
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { FlaskConical, CheckCircle2, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import type { FieldsTestApiResponse } from "@/app/api/admin/windsor/fields-test/route";
import type { FieldGroupResult } from "@/lib/integrations/windsor/fields-test";

// ── Sub-components ────────────────────────────────────────────────────────────

function GroupCard({ group }: { group: FieldGroupResult }) {
  const [open, setOpen] = useState(false);
  const accepted = group.status === "accepted";

  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left gap-3"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {accepted ? (
            <CheckCircle2 size={13} className="text-emerald-400/80 shrink-0" />
          ) : (
            <XCircle size={13} className="text-red-400/70 shrink-0" />
          )}
          <span className="text-[11px] font-light text-white/70 truncate">{group.groupName}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`text-[9px] font-light px-2 py-0.5 rounded-full border ${
              accepted
                ? "border-emerald-400/20 text-emerald-400/70 bg-emerald-400/5"
                : "border-red-400/20 text-red-400/60 bg-red-400/5"
            }`}
          >
            {accepted ? `${group.recordCount} reg.` : "Rejeitado"}
          </span>
          {open ? (
            <ChevronUp size={12} className="text-white/25" />
          ) : (
            <ChevronDown size={12} className="text-white/25" />
          )}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-3 border-t border-white/[0.04] pt-3 space-y-2">
          {/* Fields list */}
          <div className="flex flex-wrap gap-1.5">
            {group.fields.map((f) => (
              <span
                key={f}
                className="text-[9px] font-mono px-2 py-0.5 rounded border border-white/[0.08] text-white/40 bg-white/[0.02]"
              >
                {f}
              </span>
            ))}
          </div>

          {/* Error detail */}
          {group.errorDetail && (
            <p className="text-[10px] font-light text-red-400/60 leading-relaxed">
              {group.errorDetail}
            </p>
          )}

          {/* Sample values */}
          {group.sampleValues && (
            <div className="mt-2">
              <p className="text-[9px] text-white/[0.15] tracking-widest uppercase mb-1.5">
                Amostra
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                {Object.entries(group.sampleValues).map(([k, v]) => (
                  <div key={k} className="rounded bg-white/[0.02] border border-white/[0.05] px-2 py-1">
                    <p className="text-[8px] font-mono text-white/25 truncate">{k}</p>
                    <p className="text-[10px] font-light text-white/55 truncate">
                      {v === null || v === undefined ? "—" : String(v)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function WindsorFieldsTestPanel() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FieldsTestApiResponse | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  async function handleTest() {
    setLoading(true);
    setResult(null);
    setFetchError(null);

    try {
      const res = await fetch("/api/admin/windsor/fields-test", { method: "GET" });
      const json: FieldsTestApiResponse = await res.json();
      setResult(json);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Erro de conexão.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.01]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center shrink-0">
            <FlaskConical size={14} className="text-vitti-light/40" />
          </div>
          <div>
            <p className="text-xs font-light text-white/65">Teste de campos Windsor</p>
            <p className="text-[10px] font-light text-white/25 mt-0.5">
              Descobre quais campos avançados a Windsor aceita — não salva nada
            </p>
          </div>
        </div>

        <button
          onClick={handleTest}
          disabled={loading}
          className="text-[9px] font-light px-3 py-1.5 rounded-full border border-vitti-medium/40 text-vitti-light/60 hover:border-vitti-medium/70 hover:text-vitti-light/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? "Testando…" : "Testar campos avançados"}
        </button>
      </div>

      {/* Results */}
      {(result || fetchError) && (
        <div className="px-5 pb-5 border-t border-white/[0.04] pt-4 space-y-4">
          {fetchError && (
            <p className="text-[11px] font-light text-red-400/70">{fetchError}</p>
          )}

          {result?.error && (
            <p className="text-[11px] font-light text-red-400/70">{result.error}</p>
          )}

          {result && !result.error && (
            <>
              {/* Summary chips */}
              <div className="flex flex-wrap gap-2">
                <span className="text-[9px] font-light px-2.5 py-1 rounded-full border border-emerald-400/20 text-emerald-400/70 bg-emerald-400/5">
                  {result.fieldsAccepted.length} campo{result.fieldsAccepted.length !== 1 ? "s" : ""} aceito{result.fieldsAccepted.length !== 1 ? "s" : ""}
                </span>
                {result.fieldsRejected.length > 0 && (
                  <span className="text-[9px] font-light px-2.5 py-1 rounded-full border border-red-400/20 text-red-400/60 bg-red-400/5">
                    {result.fieldsRejected.length} campo{result.fieldsRejected.length !== 1 ? "s" : ""} rejeitado{result.fieldsRejected.length !== 1 ? "s" : ""}
                  </span>
                )}
                <span className="text-[9px] font-light px-2.5 py-1 rounded-full border border-white/[0.08] text-white/25 bg-white/[0.01]">
                  {new Date(result.testedAt).toLocaleTimeString("pt-BR")}
                </span>
              </div>

              {/* Group cards */}
              <div className="space-y-2">
                {result.groups.map((g) => (
                  <GroupCard key={g.groupName} group={g} />
                ))}
              </div>

              {/* Fields accepted list */}
              {result.fieldsAccepted.length > 0 && (
                <div>
                  <p className="text-[9px] text-white/[0.15] tracking-widest uppercase mb-2">
                    Campos aceitos
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.fieldsAccepted.map((f) => (
                      <span
                        key={f}
                        className="text-[9px] font-mono px-2 py-0.5 rounded border border-emerald-400/20 text-emerald-400/60 bg-emerald-400/5"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Fields rejected list */}
              {result.fieldsRejected.length > 0 && (
                <div>
                  <p className="text-[9px] text-white/[0.15] tracking-widest uppercase mb-2">
                    Campos rejeitados
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.fieldsRejected.map((f) => (
                      <span
                        key={f}
                        className="text-[9px] font-mono px-2 py-0.5 rounded border border-red-400/20 text-red-400/60 bg-red-400/5"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Sample record */}
              {result.sampleRecord && (
                <div>
                  <p className="text-[9px] text-white/[0.15] tracking-widest uppercase mb-2">
                    Amostra de registro
                  </p>
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {Object.entries(result.sampleRecord).map(([k, v]) => (
                      <div key={k}>
                        <p className="text-[8px] font-mono text-white/25 truncate">{k}</p>
                        <p className="text-[10px] font-light text-white/55 truncate">
                          {v === null || v === undefined ? "—" : String(v)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

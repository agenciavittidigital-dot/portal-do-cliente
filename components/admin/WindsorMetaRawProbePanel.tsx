"use client";

import { useState } from "react";
import { FlaskConical, ChevronDown, ChevronUp } from "lucide-react";
import type { MetaRawProbeApiResponse } from "@/app/api/admin/windsor/meta-raw-probe/route";
import type { ProbeFieldCoverage } from "@/lib/integrations/windsor/meta-raw-probe";

// ── Período ───────────────────────────────────────────────────────────────────

type DatePreset = "last_7d" | "last_14d" | "last_30d" | "last_90d";
const PRESETS: { value: DatePreset; label: string }[] = [
  { value: "last_7d", label: "7 dias" },
  { value: "last_14d", label: "14 dias" },
  { value: "last_30d", label: "30 dias" },
  { value: "last_90d", label: "90 dias" },
];

// ── Exibe valor bruto ─────────────────────────────────────────────────────────

function RawValue({ value }: { value: unknown }) {
  const [open, setOpen] = useState(false);
  if (value == null) return <span className="text-[#5F6368]/35">—</span>;
  if (typeof value === "number") {
    return (
      <span className="text-emerald-400/80 tabular-nums">
        {value.toLocaleString("pt-BR")}
      </span>
    );
  }
  if (typeof value === "string") {
    return <span className="text-[#5F6368]/70 font-mono text-[9px]">{value}</span>;
  }
  const json = JSON.stringify(value, null, 0);
  const isArr = Array.isArray(value);
  const len = isArr ? (value as unknown[]).length : Object.keys(value as object).length;
  const label = isArr ? `array[${len}]` : `object{${len}}`;
  return (
    <span>
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-amber-400/70 font-mono text-[9px] hover:text-amber-400 transition-colors"
      >
        {open ? "▲" : "▼"} {label}
      </button>
      {open && (
        <pre className="mt-1 text-[8px] text-amber-400/60 font-mono whitespace-pre-wrap break-all leading-relaxed max-h-48 overflow-y-auto">
          {json.length > 1200 ? json.slice(0, 1200) + "\n…" : json}
        </pre>
      )}
    </span>
  );
}

// ── Linha de campo ────────────────────────────────────────────────────────────

function FieldRow({ c }: { c: ProbeFieldCoverage }) {
  if (c.status === "rejected") {
    return (
      <div className="flex items-center gap-2 py-1 border-b border-white/[0.025] last:border-0">
        <span className="text-[8px] font-mono px-1.5 py-0.5 rounded border border-red-400/20 text-red-400/50 bg-red-400/[0.04] shrink-0">
          {c.field}
        </span>
        <span className="text-[8px] text-red-400/40 font-light">rejeitado</span>
      </div>
    );
  }

  const hasNum = c.realNonZero > 0;
  const hasData = c.realNonNull > 0;
  const isStructured = c.valueType === "array" || c.valueType === "object";

  const chipClass = hasNum
    ? "border-emerald-400/35 text-emerald-400/85 bg-emerald-400/[0.07]"
    : hasData && isStructured
      ? "border-amber-400/30 text-amber-400/75 bg-amber-400/[0.05]"
      : hasData
        ? "border-white/12 text-[#5F6368]/70"
        : "border-black/[0.06] text-white/18";

  return (
    <div className="flex flex-wrap items-start gap-x-3 gap-y-0.5 py-1 border-b border-white/[0.025] last:border-0">
      <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded border shrink-0 ${chipClass}`}>
        {c.field}
      </span>
      <div className="flex-1 min-w-0">
        {hasNum ? (
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            <span className="text-[8px] text-emerald-400/75 font-light">
              {c.realNonZero} registros
            </span>
            {c.accountsWithValues.length > 0 && (
              <span className="text-[8px] text-[#5F6368]/60 font-light truncate max-w-[280px]">
                {c.accountsWithValues.join(", ")}
              </span>
            )}
            {c.sampleValue != null && (
              <span className="text-[8px] text-emerald-400/60 tabular-nums">
                ex: {typeof c.sampleValue === "number" ? c.sampleValue.toLocaleString("pt-BR") : String(c.sampleValue)}
              </span>
            )}
          </div>
        ) : hasData && isStructured ? (
          <div className="space-y-0.5">
            <span className="text-[8px] text-amber-400/65 font-light">
              {c.realNonNull} registros — {c.valueType}
              {c.sampleAccount && (
                <span className="text-[#5F6368]/55 ml-1.5">({c.sampleAccount})</span>
              )}
            </span>
            {c.sampleValue != null && (
              <div>
                <RawValue value={c.sampleValue} />
              </div>
            )}
          </div>
        ) : hasData ? (
          <span className="text-[8px] text-[#5F6368]/60 font-light">
            {c.realNonNull} registros não-nulos — todos zero ou vazio
          </span>
        ) : (
          <span className="text-[8px] text-[#5F6368]/35 font-light italic">
            sem dados em contas reais
          </span>
        )}
      </div>
    </div>
  );
}

// ── Seção por categoria ───────────────────────────────────────────────────────

function CategorySection({
  name,
  fields,
  summary,
}: {
  name: string;
  fields: ProbeFieldCoverage[];
  summary: { accepted: number; rejected: number; withValues: number; withData: number };
}) {
  const [open, setOpen] = useState(summary.withValues > 0 || summary.withData > 0);

  return (
    <div className="rounded-lg border border-black/[0.06] bg-black/[0.02] overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-left gap-3"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] font-light text-[#111111]/70 truncate">{name}</span>
          <span className="text-[8px] text-[#5F6368]/50 shrink-0">{fields.length} campos</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {summary.withValues > 0 && (
            <span className="text-[8px] px-1.5 py-0.5 rounded-full border border-emerald-400/25 text-emerald-400/70 bg-emerald-400/[0.05]">
              {summary.withValues} com valores
            </span>
          )}
          {summary.withData > 0 && (
            <span className="text-[8px] px-1.5 py-0.5 rounded-full border border-amber-400/20 text-amber-400/60 bg-amber-400/[0.04]">
              {summary.withData} array/obj
            </span>
          )}
          {summary.rejected > 0 && (
            <span className="text-[8px] px-1.5 py-0.5 rounded-full border border-red-400/15 text-red-400/45">
              {summary.rejected} rejeitado{summary.rejected !== 1 ? "s" : ""}
            </span>
          )}
          {open ? (
            <ChevronUp size={10} className="text-[#5F6368]/50" />
          ) : (
            <ChevronDown size={10} className="text-[#5F6368]/50" />
          )}
        </div>
      </button>
      {open && (
        <div className="px-3 pb-2 border-t border-black/[0.05] pt-2">
          {fields.map((c) => (
            <FieldRow key={c.field} c={c} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Amostra bruta ─────────────────────────────────────────────────────────────

function RawRecordCard({
  record,
  idx,
}: {
  record: Record<string, unknown>;
  idx: number;
}) {
  const [open, setOpen] = useState(idx === 0);
  const entries = Object.entries(record);
  return (
    <div className="rounded-lg border border-black/[0.06] overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-left bg-black/[0.02]"
      >
        <span className="text-[9px] font-mono text-[#5F6368]/65 truncate">
          {String(record.date ?? "")} — {String(record.account_name ?? "?")} — {String(record.campaign ?? "?")}
        </span>
        {open ? (
          <ChevronUp size={10} className="text-[#5F6368]/50 shrink-0" />
        ) : (
          <ChevronDown size={10} className="text-[#5F6368]/50 shrink-0" />
        )}
      </button>
      {open && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 px-3 pb-3 pt-2 border-t border-black/[0.04]">
          {entries.map(([k, v]) => (
            <div key={k} className="min-w-0">
              <p className="text-[7px] font-mono text-white/18 truncate mb-0.5">{k}</p>
              <RawValue value={v} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Painel principal ──────────────────────────────────────────────────────────

export function WindsorMetaRawProbePanel() {
  const [datePreset, setDatePreset] = useState<DatePreset>("last_90d");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MetaRawProbeApiResponse | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  async function handleProbe() {
    setLoading(true);
    setResult(null);
    setFetchError(null);
    try {
      const res = await fetch(
        `/api/admin/windsor/meta-raw-probe?datePreset=${datePreset}`,
        { method: "GET" }
      );
      const json: MetaRawProbeApiResponse = await res.json();
      setResult(json);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Erro de conexão.");
    } finally {
      setLoading(false);
    }
  }

  // Agrupar fieldCoverage por categoria
  const byCategory = result?.fieldCoverage
    ? result.fieldCoverage.reduce<Record<string, ProbeFieldCoverage[]>>((acc, c) => {
        if (!acc[c.category]) acc[c.category] = [];
        acc[c.category].push(c);
        return acc;
      }, {})
    : null;

  // Detectar se categorias de conversão retornaram dados
  const CONVERSION_CATEGORY_NAMES = ["Leads / Forms", "Mensagens / Conversas", "Compras / Vendas"];
  const hasNoConversionData =
    result != null &&
    result.realRecords > 0 &&
    result.categorySummary.length > 0 &&
    CONVERSION_CATEGORY_NAMES.every((catName) => {
      const cs = result.categorySummary.find((c) => c.name === catName);
      return !cs || (cs.withValues === 0 && cs.withData === 0);
    });
  const hasRoasData = (result?.fieldsWithRealValues ?? []).some((f) =>
    ["roas", "purchase_roas", "website_purchase_roas"].includes(f)
  );

  return (
    <div className="rounded-xl border border-black/[0.07] bg-black/[0.02]">
      {/* Header */}
      <div className="px-5 py-4 space-y-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-black/[0.03] border border-black/[0.07] flex items-center justify-center shrink-0">
              <FlaskConical size={14} className="text-vitti-light/40" />
            </div>
            <div>
              <p className="text-xs font-light text-[#111111]/75">
                Probe Meta Ads — Contas Reais (Expandido)
              </p>
              <p className="text-[10px] font-light text-[#5F6368]/55 mt-0.5">
                Testa {40}+ candidatos de conversão — exclui demos — não salva nada
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1">
              {PRESETS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setDatePreset(p.value)}
                  disabled={loading}
                  className={`text-[9px] font-light px-2.5 py-1 rounded-full border transition-all disabled:opacity-40 ${
                    datePreset === p.value
                      ? "border-vitti-medium/60 text-vitti-light/80 bg-vitti-medium/10"
                      : "border-black/[0.08] text-[#5F6368]/60 hover:border-white/20"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <button
              onClick={handleProbe}
              disabled={loading}
              className="text-[9px] font-light px-3 py-1.5 rounded-full border border-vitti-medium/40 text-vitti-light/60 hover:border-vitti-medium/70 hover:text-vitti-light/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "Consultando Windsor…" : "Rodar probe"}
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {(result || fetchError) && (
        <div className="px-5 pb-5 border-t border-black/[0.05] pt-4 space-y-4">
          {fetchError && (
            <p className="text-[11px] text-red-400/70 font-light">{fetchError}</p>
          )}
          {result?.error && (
            <p className="text-[11px] text-red-400/70 font-light">{result.error}</p>
          )}

          {result && !result.error && (
            <>
              {/* Chips de resumo */}
              <div className="flex flex-wrap gap-2">
                <span className="text-[9px] px-2.5 py-1 rounded-full border border-black/[0.08] text-[#5F6368]/60">
                  {result.totalRecords} registros · {result.datePreset}
                </span>
                <span className="text-[9px] px-2.5 py-1 rounded-full border border-black/[0.08] text-white/22">
                  {result.demoRecords} demo excluídos
                </span>
                <span
                  className={`text-[9px] px-2.5 py-1 rounded-full border ${
                    result.realRecords > 0
                      ? "border-emerald-400/20 text-emerald-400/70"
                      : "border-red-400/20 text-red-400/50"
                  }`}
                >
                  {result.realRecords} reais
                </span>
                {result.fieldsWithRealValues.length > 0 ? (
                  <span className="text-[9px] px-2.5 py-1 rounded-full border border-emerald-400/30 text-emerald-400/80 bg-emerald-400/[0.06]">
                    {result.fieldsWithRealValues.length} campo{result.fieldsWithRealValues.length !== 1 ? "s" : ""} com valores reais
                  </span>
                ) : (
                  <span className="text-[9px] px-2.5 py-1 rounded-full border border-red-400/20 text-red-400/50">
                    nenhum campo de conversão com dados reais
                  </span>
                )}
              </div>

              {/* Contas reais */}
              {result.realAccountNames.length > 0 && (
                <div>
                  <p className="text-[8px] text-white/18 tracking-[0.15em] uppercase mb-1.5">
                    Contas reais na Windsor
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.realAccountNames.map((name) => (
                      <span
                        key={name}
                        className="text-[9px] px-2 py-0.5 rounded-full border border-black/[0.08] text-[#5F6368]/70"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {result.realRecords === 0 ? (
                <div className="rounded-lg border border-amber-400/15 bg-amber-400/[0.03] px-4 py-3">
                  <p className="text-[10px] text-amber-400/70 font-light leading-relaxed">
                    Windsor não retornou registros de contas reais no período. Tente 90 dias ou verifique os mapeamentos de conta.
                  </p>
                </div>
              ) : (
                <>
                  {/* Alerta: Windsor não entregou métricas de conversão */}
                  {hasNoConversionData && (
                    <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.05] px-4 py-3 space-y-1.5">
                      <p className="text-[10px] text-amber-400/85 font-light leading-relaxed">
                        A Windsor não retornou métricas de conversão para contas reais neste período.
                        Verifique a configuração da fonte Meta Ads dentro da Windsor.
                      </p>
                      {hasRoasData ? (
                        <p className="text-[9px] text-[#5F6368]/65 font-light">
                          Apenas{" "}
                          <span className="font-mono text-[#111111]/65">roas</span>{" "}
                          retornou valor real — Leads, Mensagens e Compras não foram entregues.
                          O problema está na configuração da fonte Meta Ads na Windsor, não no código do portal.
                        </p>
                      ) : (
                        <p className="text-[9px] text-[#5F6368]/60 font-light">
                          Nenhum campo de conversão (Leads, Mensagens, Compras, ROAS) retornou valor real.
                          O problema está na configuração da fonte Meta Ads na Windsor, não no código do portal.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Campos com valores numéricos */}
                  {result.fieldsWithRealValues.length > 0 && (
                    <div className="rounded-lg border border-emerald-400/15 bg-emerald-400/[0.02] px-4 py-3 space-y-1.5">
                      <p className="text-[8px] text-emerald-400/50 tracking-[0.15em] uppercase">
                        Campos com valores numéricos em contas reais
                      </p>
                      {result.fieldCoverage
                        .filter((c) => c.realNonZero > 0)
                        .map((c) => (
                          <div key={c.field} className="flex flex-wrap items-center gap-2">
                            <span className="text-[8px] font-mono px-1.5 py-0.5 rounded border border-emerald-400/30 text-emerald-400/85 bg-emerald-400/[0.07]">
                              {c.field}
                            </span>
                            <span className="text-[8px] text-[#5F6368]/55 font-light">{c.category}</span>
                            <span className="text-[8px] text-emerald-400/65 font-light">
                              {c.realNonZero} registros · {c.accountsWithValues.join(", ")}
                            </span>
                            {c.sampleValue != null && (
                              <span className="text-[8px] text-emerald-400/50 tabular-nums">
                                ex:{" "}
                                {typeof c.sampleValue === "number"
                                  ? c.sampleValue.toLocaleString("pt-BR")
                                  : String(c.sampleValue)}
                              </span>
                            )}
                          </div>
                        ))}
                    </div>
                  )}

                  {/* Campos com arrays/objetos */}
                  {result.fieldsWithRealData.length > 0 && (
                    <div className="rounded-lg border border-amber-400/12 bg-amber-400/[0.02] px-4 py-3 space-y-1.5">
                      <p className="text-[8px] text-amber-400/50 tracking-[0.15em] uppercase">
                        Campos com dados não-numéricos (arrays/objetos) — expandir categoria para ver
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {result.fieldCoverage
                          .filter((c) => c.realNonNull > 0 && c.realNonZero === 0)
                          .map((c) => (
                            <span
                              key={c.field}
                              className="text-[8px] font-mono px-1.5 py-0.5 rounded border border-amber-400/20 text-amber-400/65"
                              title={`${c.valueType} — ${c.realNonNull} registros — ${c.sampleAccount ?? ""}`}
                            >
                              {c.field}
                            </span>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Aviso se nenhum campo retornou dados */}
                  {result.fieldsWithRealValues.length === 0 && result.fieldsWithRealData.length === 0 && (
                    <div className="rounded-lg border border-red-400/12 bg-red-400/[0.02] px-4 py-3">
                      <p className="text-[10px] text-red-400/60 font-light leading-relaxed">
                        Nenhum dos {result.fieldCoverage.filter((c) => c.status === "accepted").length} campos aceitos
                        retornou dados de conversão para contas reais. A Windsor não está entregando conversões
                        para este endpoint neste período. O problema está na configuração da fonte Meta Ads dentro da Windsor,
                        não no código do portal.
                      </p>
                    </div>
                  )}

                  {/* Categorias */}
                  {byCategory && (
                    <div className="space-y-2">
                      <p className="text-[8px] text-white/18 tracking-[0.15em] uppercase">
                        Cobertura por categoria — contas reais
                      </p>
                      {result.categorySummary.map((cs) => {
                        const fields = byCategory[cs.name] ?? [];
                        return (
                          <CategorySection
                            key={cs.name}
                            name={cs.name}
                            fields={fields}
                            summary={cs}
                          />
                        );
                      })}
                    </div>
                  )}

                  {/* Amostra de registros */}
                  {result.sampleRealRecords.length > 0 && (
                    <div>
                      <p className="text-[8px] text-white/18 tracking-[0.15em] uppercase mb-2">
                        Amostra — {result.sampleRealRecords.length} registros reais (campos com valor)
                      </p>
                      <div className="space-y-1.5">
                        {result.sampleRealRecords.map((rec, i) => (
                          <RawRecordCard key={i} record={rec} idx={i} />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              <p className="text-[7px] text-white/12 font-light">
                {new Date(result.testedAt).toLocaleString("pt-BR")} — nenhum dado foi salvo
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

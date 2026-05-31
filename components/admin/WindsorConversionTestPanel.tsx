"use client";

import { useState } from "react";
import { Microscope, ChevronDown, ChevronUp, Info } from "lucide-react";
import { CATEGORY_LABELS } from "@/lib/integrations/windsor/conversion-fields-types";
import type {
  ConversionFieldStat,
  ConversionCategory,
  DatePreset,
  WindsorEndpoint,
} from "@/lib/integrations/windsor/conversion-fields-types";
import type { ConversionTestApiResponse } from "@/app/api/admin/windsor/conversion-fields-test/route";

// ── Constantes de UI ───────────────────────────────────────────────────────────

const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  last_7d: "7 dias",
  last_14d: "14 dias",
  last_30d: "30 dias",
  last_90d: "90 dias",
};

const DATE_PRESETS: DatePreset[] = ["last_7d", "last_14d", "last_30d", "last_90d"];
const ENDPOINTS: WindsorEndpoint[] = ["all", "facebook"];
const CATEGORY_ORDER: ConversionCategory[] = ["actions", "messages", "leads", "purchases"];

// ── Exibição de valor amostrado ────────────────────────────────────────────────

function SampleValuePreview({ value }: { value: unknown }) {
  if (value == null) return <span className="text-[#5F6368]/50">—</span>;
  if (typeof value === "number") {
    return <span className="text-emerald-400/70">{value.toLocaleString("pt-BR")}</span>;
  }
  if (typeof value === "string") {
    return <span className="text-[#5F6368]/80 font-mono text-[9px]">{value}</span>;
  }
  // array ou objeto — mostra JSON compacto
  const json = JSON.stringify(value, null, 0);
  const display = json.length > 200 ? json.slice(0, 200) + "…" : json;
  return (
    <pre className="text-[8px] font-mono text-amber-400/70 whitespace-pre-wrap break-all leading-relaxed">
      {display}
    </pre>
  );
}

// ── Linha de campo por resultado ───────────────────────────────────────────────

function FieldRow({ stat }: { stat: ConversionFieldStat }) {
  const [expanded, setExpanded] = useState(false);

  if (stat.status === "rejected") {
    return (
      <div className="flex items-center gap-2 py-1.5 border-b border-black/[0.04] last:border-0">
        <span className="text-[9px] font-mono px-2 py-0.5 rounded border border-red-400/20 text-red-400/50 bg-red-400/5 shrink-0">
          {stat.field}
        </span>
        <span className="text-[9px] text-[#5F6368]/50 font-light">rejeitado</span>
        {stat.errorDetail && (
          <span className="text-[9px] text-red-400/40 font-light truncate">{stat.errorDetail}</span>
        )}
      </div>
    );
  }

  const hasNumeric = stat.nonZeroRows > 0;
  const hasData = stat.nonNullRows > 0;
  const isArray = stat.valueType === "array";
  const isObject = stat.valueType === "object";
  const isNonNumeric = isArray || isObject || stat.valueType === "string";

  const chipClass = hasNumeric
    ? "border-emerald-400/30 text-emerald-400/80 bg-emerald-400/[0.08]"
    : hasData
      ? "border-amber-400/25 text-amber-400/70 bg-amber-400/[0.06]"
      : "border-emerald-400/15 text-emerald-400/40 bg-emerald-400/[0.03]";

  return (
    <div className="border-b border-black/[0.04] last:border-0">
      <div className="flex items-start gap-2 py-1.5">
        <span className={`text-[9px] font-mono px-2 py-0.5 rounded border shrink-0 ${chipClass}`}>
          {stat.field}
        </span>
        <div className="flex-1 min-w-0">
          {hasNumeric ? (
            <div className="flex flex-wrap gap-x-3 gap-y-0.5">
              <span className="text-[9px] font-light text-emerald-400/70">
                {stat.totalValue.toLocaleString("pt-BR")} total
              </span>
              <span className="text-[9px] font-light text-[#5F6368]/60">
                {stat.nonZeroRows} {stat.nonZeroRows === 1 ? "linha" : "linhas"}
              </span>
              {stat.sampleCampaign && (
                <span className="text-[9px] font-light text-[#5F6368]/55 truncate max-w-[200px]">
                  {stat.sampleCampaign}
                </span>
              )}
            </div>
          ) : isNonNumeric && hasData ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[9px] font-light text-amber-400/70">
                {isArray ? "array" : isObject ? "objeto" : "texto"} —{" "}
                {stat.nonNullRows} {stat.nonNullRows === 1 ? "linha" : "linhas"}
              </span>
              {stat.sampleValue != null && (
                <button
                  onClick={() => setExpanded((v) => !v)}
                  className="text-[9px] font-light text-[#5F6368]/60 hover:text-[#111111]/75 transition-colors"
                >
                  {expanded ? "ocultar" : "ver amostra"}
                </button>
              )}
            </div>
          ) : (
            <span className="text-[9px] font-light text-[#5F6368]/50">
              aceito — sem valores no período
            </span>
          )}
        </div>
      </div>
      {expanded && stat.sampleValue != null && (
        <div className="pb-2 pl-2">
          <SampleValuePreview value={stat.sampleValue} />
        </div>
      )}
    </div>
  );
}

// ── Seção por categoria ────────────────────────────────────────────────────────

function CategorySection({
  category,
  stats,
}: {
  category: ConversionCategory;
  stats: ConversionFieldStat[];
}) {
  const [open, setOpen] = useState(false);
  const accepted = stats.filter((s) => s.status === "accepted").length;
  const withValues = stats.filter((s) => s.nonZeroRows > 0).length;
  const withData = stats.filter((s) => s.nonNullRows > 0 && s.nonZeroRows === 0).length;

  return (
    <div className="rounded-lg border border-black/[0.07] bg-black/[0.02] overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left gap-3"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-[11px] font-light text-[#111111]/80 truncate">
            {CATEGORY_LABELS[category]}
          </span>
          <span className="text-[9px] text-[#5F6368]/55 font-light shrink-0">
            {stats.length} candidatos
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {withValues > 0 && (
            <span className="text-[9px] px-2 py-0.5 rounded-full border border-emerald-400/25 text-emerald-400/70 bg-emerald-400/5">
              {withValues} numérico{withValues !== 1 ? "s" : ""}
            </span>
          )}
          {withData > 0 && (
            <span className="text-[9px] px-2 py-0.5 rounded-full border border-amber-400/20 text-amber-400/60 bg-amber-400/5">
              {withData} não-nulo{withData !== 1 ? "s" : ""}
            </span>
          )}
          <span className="text-[9px] px-2 py-0.5 rounded-full border border-black/[0.08] text-[#5F6368]/60">
            {accepted}/{stats.length}
          </span>
          {open ? (
            <ChevronUp size={12} className="text-[#5F6368]/55" />
          ) : (
            <ChevronDown size={12} className="text-[#5F6368]/55" />
          )}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-3 border-t border-black/[0.05] pt-3">
          {stats.map((s) => (
            <FieldRow key={s.field} stat={s} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function groupByCategory(
  results: ConversionFieldStat[]
): Record<ConversionCategory, ConversionFieldStat[]> {
  const groups: Record<ConversionCategory, ConversionFieldStat[]> = {
    actions: [],
    messages: [],
    leads: [],
    purchases: [],
  };
  for (const r of results) {
    groups[r.category].push(r);
  }
  return groups;
}

// ── Selector pill ──────────────────────────────────────────────────────────────

function SelectorPill<T extends string>({
  value,
  options,
  labels,
  onChange,
  disabled,
}: {
  value: T;
  options: T[];
  labels: Record<T, string>;
  onChange: (v: T) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          disabled={disabled}
          className={`text-[9px] font-light px-2.5 py-1 rounded-full border transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
            value === opt
              ? "border-vitti-medium/60 text-vitti-light/80 bg-vitti-medium/10"
              : "border-black/[0.08] text-[#5F6368]/60 hover:border-white/20 hover:text-[#111111]/70"
          }`}
        >
          {labels[opt]}
        </button>
      ))}
    </div>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────────

export function WindsorConversionTestPanel() {
  const [datePreset, setDatePreset] = useState<DatePreset>("last_7d");
  const [endpoint, setEndpoint] = useState<WindsorEndpoint>("all");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ConversionTestApiResponse | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  async function handleTest() {
    setLoading(true);
    setResult(null);
    setFetchError(null);
    try {
      const params = new URLSearchParams({ datePreset, endpoint });
      const res = await fetch(
        `/api/admin/windsor/conversion-fields-test?${params.toString()}`,
        { method: "GET" }
      );
      const json: ConversionTestApiResponse = await res.json();
      setResult(json);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Erro de conexão.");
    } finally {
      setLoading(false);
    }
  }

  const byCategory = result?.results ? groupByCategory(result.results) : null;

  return (
    <div className="rounded-xl border border-black/[0.07] bg-black/[0.02]">
      {/* Header */}
      <div className="px-5 py-4 space-y-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-black/[0.03] border border-black/[0.07] flex items-center justify-center shrink-0">
              <Microscope size={14} className="text-vitti-light/40" />
            </div>
            <div>
              <p className="text-xs font-light text-[#111111]/75">Diagnóstico de Conversões Meta</p>
              <p className="text-[10px] font-light text-[#5F6368]/55 mt-0.5">
                Descobre quais campos Windsor retornam mensagens, leads e compras reais — não salva nada
              </p>
            </div>
          </div>

          <button
            onClick={handleTest}
            disabled={loading}
            className="text-[9px] font-light px-3 py-1.5 rounded-full border border-vitti-medium/40 text-vitti-light/60 hover:border-vitti-medium/70 hover:text-vitti-light/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            {loading ? "Testando campos…" : "Testar campos de conversão"}
          </button>
        </div>

        {/* Seletores */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-[#5F6368]/50 font-light uppercase tracking-wider">
              Período
            </span>
            <SelectorPill
              value={datePreset}
              options={DATE_PRESETS}
              labels={DATE_PRESET_LABELS}
              onChange={setDatePreset}
              disabled={loading}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-[#5F6368]/50 font-light uppercase tracking-wider">
              Endpoint
            </span>
            <SelectorPill
              value={endpoint}
              options={ENDPOINTS}
              labels={{ all: "/all", facebook: "/facebook" }}
              onChange={setEndpoint}
              disabled={loading}
            />
          </div>
        </div>

        {/* Nota explicativa */}
        <div className="flex items-start gap-2 rounded-lg border border-black/[0.06] bg-black/[0.02] px-3 py-2">
          <Info size={11} className="text-[#5F6368]/50 shrink-0 mt-0.5" />
          <p className="text-[9px] font-light text-[#5F6368]/55 leading-relaxed">
            <span className="text-[#5F6368]/70">Campo aceito</span> não significa campo com valor.
            Um campo aceito pela Windsor pode retornar null/0 se não houver eventos no período.
            O objetivo é encontrar campos com valores reais &gt; 0 ou dados não-numéricos como arrays de ações.
          </p>
        </div>
      </div>

      {/* Results */}
      {(result || fetchError) && (
        <div className="px-5 pb-5 border-t border-black/[0.05] pt-4 space-y-4">
          {fetchError && (
            <p className="text-[11px] font-light text-red-400/70">{fetchError}</p>
          )}
          {result?.error && (
            <p className="text-[11px] font-light text-red-400/70">{result.error}</p>
          )}

          {result && !result.error && byCategory && (
            <>
              {/* Summary chips */}
              <div className="flex flex-wrap gap-2">
                <span className="text-[9px] font-light px-2.5 py-1 rounded-full border border-black/[0.08] text-[#5F6368]/60">
                  {result.totalFetched} linhas · {DATE_PRESET_LABELS[result.datePreset]} · /{result.endpoint}
                </span>
                <span className="text-[9px] font-light px-2.5 py-1 rounded-full border border-emerald-400/20 text-emerald-400/70 bg-emerald-400/5">
                  {result.fieldsAccepted.length} aceito{result.fieldsAccepted.length !== 1 ? "s" : ""}
                </span>
                {result.fieldsRejected.length > 0 && (
                  <span className="text-[9px] font-light px-2.5 py-1 rounded-full border border-red-400/20 text-red-400/60 bg-red-400/5">
                    {result.fieldsRejected.length} rejeitado{result.fieldsRejected.length !== 1 ? "s" : ""}
                  </span>
                )}
                {result.fieldsWithValues.length > 0 ? (
                  <span className="text-[9px] font-light px-2.5 py-1 rounded-full border border-emerald-400/40 text-emerald-400/90 bg-emerald-400/10">
                    {result.fieldsWithValues.length} numérico{result.fieldsWithValues.length !== 1 ? "s" : ""} com valores
                  </span>
                ) : result.fieldsWithData.length > 0 ? (
                  <span className="text-[9px] font-light px-2.5 py-1 rounded-full border border-amber-400/25 text-amber-400/70 bg-amber-400/5">
                    {result.fieldsWithData.length} campo{result.fieldsWithData.length !== 1 ? "s" : ""} com dados não-numéricos
                  </span>
                ) : (
                  <span className="text-[9px] font-light px-2.5 py-1 rounded-full border border-red-400/20 text-red-400/50 bg-red-400/5">
                    nenhum campo com dados no período
                  </span>
                )}
                <span className="text-[9px] font-light px-2.5 py-1 rounded-full border border-black/[0.08] text-[#5F6368]/55">
                  {new Date(result.testedAt).toLocaleTimeString("pt-BR")}
                </span>
              </div>

              {/* Campos com valores numéricos reais */}
              {result.fieldsWithValues.length > 0 && (
                <div className="rounded-lg border border-emerald-400/15 bg-emerald-400/[0.03] px-4 py-3 space-y-2">
                  <p className="text-[9px] text-emerald-400/50 tracking-[0.15em] uppercase">
                    Campos com valores numéricos reais
                  </p>
                  {result.results
                    .filter((r) => r.nonZeroRows > 0)
                    .map((r) => (
                      <div key={r.field} className="flex items-center gap-3 flex-wrap">
                        <span className="text-[9px] font-mono px-2 py-0.5 rounded border border-emerald-400/30 text-emerald-400/80 bg-emerald-400/[0.08]">
                          {r.field}
                        </span>
                        <span className="text-[9px] text-[#5F6368]/55 font-light">
                          {CATEGORY_LABELS[r.category]}
                        </span>
                        <span className="text-[9px] font-light text-emerald-400/60">
                          {r.totalValue.toLocaleString("pt-BR")} total &middot; {r.nonZeroRows}{" "}
                          {r.nonZeroRows === 1 ? "linha" : "linhas"}
                        </span>
                        {r.sampleCampaign && (
                          <span className="text-[9px] font-light text-[#5F6368]/50 truncate max-w-[200px]">
                            {r.sampleCampaign}
                          </span>
                        )}
                      </div>
                    ))}
                </div>
              )}

              {/* Campos com dados não-numéricos (arrays/objetos — possíveis action arrays) */}
              {result.fieldsWithValues.length === 0 && result.fieldsWithData.length > 0 && (
                <div className="rounded-lg border border-amber-400/15 bg-amber-400/[0.03] px-4 py-3 space-y-2">
                  <p className="text-[9px] text-amber-400/50 tracking-[0.15em] uppercase">
                    Campos com dados não-numéricos
                  </p>
                  <p className="text-[9px] font-light text-[#5F6368]/55 leading-relaxed">
                    Estes campos retornaram valores, mas em formato não-numérico (possivelmente arrays de ações).
                    Expanda a categoria correspondente para ver a amostra.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.results
                      .filter((r) => r.nonNullRows > 0 && r.nonZeroRows === 0)
                      .map((r) => (
                        <span
                          key={r.field}
                          className="text-[9px] font-mono px-2 py-0.5 rounded border border-amber-400/25 text-amber-400/70 bg-amber-400/[0.06]"
                          title={`${r.valueType} — ${r.nonNullRows} linhas`}
                        >
                          {r.field}
                        </span>
                      ))}
                  </div>
                </div>
              )}

              {/* Seções por categoria */}
              <div className="space-y-2">
                {CATEGORY_ORDER.map((cat) => {
                  const stats = byCategory[cat];
                  if (!stats.length) return null;
                  return (
                    <CategorySection key={cat} category={cat} stats={stats} />
                  );
                })}
              </div>

              {/* Amostra de linhas brutas */}
              {result.sampleRows.length > 0 && (
                <div>
                  <p className="text-[9px] text-white/[0.15] tracking-[0.15em] uppercase mb-2">
                    Amostra — {result.sampleRows.length}{" "}
                    {result.sampleRows.length === 1 ? "linha" : "linhas"}
                  </p>
                  <div className="space-y-2">
                    {result.sampleRows.map((row, i) => {
                      const entries = Object.entries(row).filter(([k, v]) => {
                        if (["date", "account_name", "campaign"].includes(k)) return true;
                        if (v == null || v === 0 || v === "0" || v === "") return false;
                        return true;
                      });
                      return (
                        <div
                          key={i}
                          className="rounded-lg border border-black/[0.06] bg-black/[0.02] px-3 py-2 grid grid-cols-2 sm:grid-cols-3 gap-1.5"
                        >
                          {entries.map(([k, v]) => (
                            <div key={k}>
                              <p className="text-[8px] font-mono text-[#5F6368]/50 truncate">{k}</p>
                              <div className="text-[10px] font-light text-[#5F6368]/80 truncate">
                                <SampleValuePreview value={v} />
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
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

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  LayoutDashboard,
  BarChart3,
  ChevronLeft,
  AlertCircle,
  Check,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdminClientRow } from "@/lib/data/clients-admin";
import type {
  ClientDashboardConfig,
  AdminDashboard,
  AdminDashboardBlock,
  AdminBlockMetric,
} from "@/lib/data/dashboards-admin";
import type { DashboardsApiResponse } from "@/app/api/admin/dashboards/route";

// ── Inline edit ───────────────────────────────────────────────────────────────

function InlineEdit({
  value,
  placeholder,
  onSave,
  mono,
}: {
  value: string;
  placeholder: string;
  onSave: (v: string) => void;
  mono?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function commit() {
    setEditing(false);
    if (draft !== value) onSave(draft);
  }

  if (!editing) {
    return (
      <span
        onClick={() => { setDraft(value); setEditing(true); }}
        className={cn(
          "cursor-text rounded px-1 py-0.5 hover:bg-black/[0.05] transition-colors text-[11px]",
          mono ? "font-mono text-[#5F6368]/80" : "text-[#111111]/75",
          !value && "text-[#5F6368]/50 italic"
        )}
        title="Clique para editar"
      >
        {value || placeholder}
      </span>
    );
  }

  return (
    <input
      ref={inputRef}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") { setEditing(false); setDraft(value); }
      }}
      className={cn(
        "rounded border border-vitti-blue/30 bg-white px-1.5 py-0.5 text-[11px] text-[#111111]/90 focus:outline-none w-40",
        mono && "font-mono"
      )}
    />
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={cn(
        "relative inline-flex h-4 w-7 items-center rounded-full border transition-colors shrink-0 disabled:opacity-40",
        checked
          ? "bg-emerald-500/30 border-emerald-500/40"
          : "bg-black/[0.04] border-black/[0.10]"
      )}
    >
      <span
        className={cn(
          "inline-block h-2.5 w-2.5 rounded-full transition-transform",
          checked
            ? "translate-x-3.5 bg-emerald-400"
            : "translate-x-0.5 bg-white/30"
        )}
      />
    </button>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const pub = status === "published";
  return (
    <span
      className={cn(
        "text-[9px] font-light px-2 py-0.5 rounded-full border",
        pub
          ? "border-emerald-500/20 text-emerald-400/80 bg-emerald-500/5"
          : "border-black/[0.08] text-[#5F6368]/60"
      )}
    >
      {pub ? "Publicado" : "Rascunho"}
    </span>
  );
}

// ── Feedback line ─────────────────────────────────────────────────────────────

function FeedbackLine({ type, msg }: { type: "success" | "error"; msg: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[9px] font-light",
        type === "success" ? "text-emerald-400/70" : "text-red-400/60"
      )}
    >
      {type === "success" ? <Check size={9} /> : <AlertCircle size={9} />}
      {msg}
    </span>
  );
}

// ── Métricas disponíveis para o gráfico de evolução (Meta Ads) ───────────────

const AVAILABLE_EVOLUTION_METRICS = [
  { key: "spend",            label: "Investimento" },
  { key: "impressions",      label: "Impressões" },
  { key: "reach",            label: "Alcance" },
  { key: "clicks",           label: "Cliques" },
  { key: "messages_started", label: "Mensagens" },
  { key: "leads",            label: "Leads" },
  { key: "frequency",        label: "Frequência" },
  { key: "ctr",              label: "CTR" },
  { key: "cpc",              label: "CPC" },
  { key: "cpm",              label: "CPM" },
  { key: "purchases",        label: "Compras" },
  { key: "purchase_value",   label: "Vlr. Compra" },
  { key: "cost_per_lead",    label: "CPL" },
];

// ── Metric row ────────────────────────────────────────────────────────────────

function MetricRow({
  metric,
  onPatch,
}: {
  metric: AdminBlockMetric;
  onPatch: (id: string, patch: Record<string, unknown>) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [localMetric, setLocalMetric] = useState(metric);

  function flash(type: "success" | "error", msg: string) {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 2500);
  }

  async function patch(p: Record<string, unknown>) {
    const prev = { ...localMetric };
    setLocalMetric((m) => ({ ...m, ...p }));
    setSaving(true);
    try {
      await onPatch(metric.id, p);
      flash("success", "Salvo");
    } catch {
      setLocalMetric(prev);
      flash("error", "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={cn(
        "grid items-center gap-x-3 px-4 py-2 text-[10px] font-light border-b border-white/[0.025] last:border-0 transition-colors",
        !localMetric.visible && "opacity-40"
      )}
      style={{ gridTemplateColumns: "1fr 1fr auto auto auto auto" }}
    >
      {/* Display name */}
      <div className="min-w-0">
        <InlineEdit
          value={localMetric.display_name ?? ""}
          placeholder={localMetric.metricName ?? "—"}
          onSave={(v) => patch({ display_name: v || null })}
        />
        {localMetric.metricKey && (
          <p className="text-[8px] font-mono text-[#5F6368]/50 mt-0.5 px-1">{localMetric.metricKey}</p>
        )}
      </div>

      {/* Format + source */}
      <p className="text-[#5F6368]/50 truncate">
        {localMetric.metricFormat ?? localMetric.source_field ?? "—"}
      </p>

      {/* Visible */}
      <div className="flex items-center gap-1">
        <Toggle
          checked={localMetric.visible}
          onChange={(v) => patch({ visible: v })}
          disabled={saving}
        />
      </div>

      {/* show_variation */}
      <div className="flex items-center gap-1">
        <span className="text-[8px] text-[#5F6368]/50">Var.</span>
        <Toggle
          checked={localMetric.show_variation ?? false}
          onChange={(v) => patch({ show_variation: v })}
          disabled={saving}
        />
      </div>

      {/* show_sparkline */}
      <div className="flex items-center gap-1">
        <span className="text-[8px] text-[#5F6368]/50">Graf.</span>
        <Toggle
          checked={localMetric.show_sparkline ?? false}
          onChange={(v) => patch({ show_sparkline: v })}
          disabled={saving}
        />
      </div>

      {/* Feedback */}
      <div className="w-16 text-right">
        {saving ? (
          <Loader2 size={10} className="animate-spin text-[#5F6368]/60 inline" />
        ) : feedback ? (
          <FeedbackLine {...feedback} />
        ) : null}
      </div>
    </div>
  );
}

// ── Block card ────────────────────────────────────────────────────────────────

function BlockCard({
  block,
  onPatch,
  onPatchMetric,
}: {
  block: AdminDashboardBlock;
  onPatch: (id: string, patch: Record<string, unknown>) => Promise<void>;
  onPatchMetric: (id: string, patch: Record<string, unknown>) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [localBlock, setLocalBlock] = useState(block);

  function flash(type: "success" | "error", msg: string) {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 2500);
  }

  async function patch(p: Record<string, unknown>) {
    const prev = { ...localBlock };
    if ("settingsPatch" in p && typeof p.settingsPatch === "object") {
      setLocalBlock((b) => ({
        ...b,
        settings: { ...(b.settings ?? {}), ...(p.settingsPatch as Record<string, unknown>) },
      }));
    } else {
      setLocalBlock((b) => ({ ...b, ...p }));
    }
    setSaving(true);
    try {
      await onPatch(block.id, p);
      flash("success", "Salvo");
    } catch {
      setLocalBlock(prev);
      flash("error", "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  function toggleEvolutionMetric(key: string) {
    const current = Array.isArray(localBlock.settings?.evolution_metrics)
      ? (localBlock.settings!.evolution_metrics as string[])
      : [];
    const next = current.includes(key)
      ? current.filter((k) => k !== key)
      : [...current, key];
    patch({ settingsPatch: { evolution_metrics: next } });
  }

  const SIZES = ["small", "medium", "large", "full"];

  return (
    <div
      className={cn(
        "rounded-xl border border-black/[0.06] overflow-hidden",
        !localBlock.visible && "opacity-50"
      )}
    >
      {/* Block header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-black/[0.02]">
        {/* Expand arrow */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-[#5F6368]/55 hover:text-[#111111]/75 transition-colors shrink-0"
        >
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>

        {/* Position */}
        <span className="text-[10px] font-mono text-[#5F6368]/55 w-5 shrink-0">
          {localBlock.position}
        </span>

        {/* Title */}
        <InlineEdit
          value={localBlock.title ?? ""}
          placeholder="Sem título"
          onSave={(v) => patch({ title: v || null })}
        />

        <div className="flex-1" />

        {/* Metric count */}
        <span className="text-[9px] text-[#5F6368]/50 shrink-0">
          {block.metrics.length} métr.
        </span>

        {/* Size select */}
        <select
          value={localBlock.size ?? ""}
          onChange={(e) => patch({ size: e.target.value || null })}
          className="text-[9px] font-light bg-black/[0.03] border border-black/[0.08] rounded px-1.5 py-0.5 text-[#5F6368]/70 focus:outline-none"
        >
          <option value="">—</option>
          {SIZES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        {/* Visible */}
        <Toggle
          checked={localBlock.visible}
          onChange={(v) => patch({ visible: v })}
          disabled={saving}
        />

        {/* Feedback */}
        {saving ? (
          <Loader2 size={11} className="animate-spin text-[#5F6368]/60 shrink-0" />
        ) : feedback ? (
          <FeedbackLine {...feedback} />
        ) : null}
      </div>

      {/* Expanded: description + metrics */}
      {expanded && (
        <div className="border-t border-black/[0.05]">
          {/* Description */}
          <div className="px-4 py-2.5 border-b border-black/[0.04] flex items-center gap-2">
            <span className="text-[9px] text-[#5F6368]/50 uppercase tracking-widest shrink-0">
              Descrição
            </span>
            <InlineEdit
              value={localBlock.description ?? ""}
              placeholder="Sem descrição"
              onSave={(v) => patch({ description: v || null })}
            />
          </div>

          {/* Evolution metrics picker — only for meta_ads blocks */}
          {localBlock.channel === "meta_ads" && (
            <div className="px-4 py-3 border-b border-black/[0.04]">
              <p className="text-[9px] text-[#5F6368]/50 uppercase tracking-widest mb-2">
                Métricas do gráfico de evolução
              </p>
              <div className="flex flex-wrap gap-1.5">
                {AVAILABLE_EVOLUTION_METRICS.map((m) => {
                  const selected = Array.isArray(localBlock.settings?.evolution_metrics)
                    ? (localBlock.settings!.evolution_metrics as string[]).includes(m.key)
                    : false;
                  return (
                    <button
                      key={m.key}
                      onClick={() => toggleEvolutionMetric(m.key)}
                      disabled={saving}
                      className={cn(
                        "text-[9px] px-2 py-0.5 rounded border transition-colors disabled:opacity-40",
                        selected
                          ? "bg-vitti-blue/10 border-vitti-blue/30 text-vitti-blue"
                          : "bg-black/[0.02] border-black/[0.08] text-[#5F6368]/60 hover:border-vitti-blue/20 hover:text-[#5F6368]/80"
                      )}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[8px] text-[#5F6368]/35 mt-1.5 font-light">
                Se nenhuma selecionada, usa padrão: Investimento + Mensagens/Leads
              </p>
            </div>
          )}

          {/* Metrics table */}
          {block.metrics.length === 0 ? (
            <p className="px-4 py-3 text-[10px] text-[#5F6368]/50 font-light">
              Nenhuma métrica vinculada.
            </p>
          ) : (
            <div>
              {/* Header */}
              <div
                className="grid px-4 py-1.5 bg-black/[0.02] border-b border-black/[0.05] text-[8px] text-[#5F6368]/50 uppercase tracking-widest"
                style={{ gridTemplateColumns: "1fr 1fr auto auto auto auto" }}
              >
                <span>Nome / Key</span>
                <span>Formato</span>
                <span>Visível</span>
                <span></span>
                <span></span>
                <span></span>
              </div>
              {block.metrics.map((m) => (
                <MetricRow key={m.id} metric={m} onPatch={onPatchMetric} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Dashboard card ────────────────────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { value: "today", label: "Hoje" },
  { value: "last_7_days", label: "Últimos 7 dias" },
  { value: "last_14_days", label: "Últimos 14 dias" },
  { value: "last_30_days", label: "Últimos 30 dias" },
];

function DashboardCard({
  dashboard,
  clientId,
  onPatch,
  onPatchBlock,
  onPatchMetric,
}: {
  dashboard: AdminDashboard;
  clientId: string;
  onPatch: (id: string, patch: Record<string, unknown>) => Promise<void>;
  onPatchBlock: (id: string, patch: Record<string, unknown>) => Promise<void>;
  onPatchMetric: (id: string, patch: Record<string, unknown>) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [localDash, setLocalDash] = useState(dashboard);

  const defaultPeriod =
    (localDash.settings?.default_period as string) ?? "last_7_days";
  const comparePrev =
    (localDash.settings?.compare_previous_period as boolean) ?? false;

  function flash(type: "success" | "error", msg: string) {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 2500);
  }

  async function patchDash(apiPatch: Record<string, unknown>) {
    const prev = { ...localDash };
    // Optimistic
    if (apiPatch.status) setLocalDash((d) => ({ ...d, status: apiPatch.status as string }));
    if (apiPatch.settingsPatch) {
      setLocalDash((d) => ({
        ...d,
        settings: { ...(d.settings ?? {}), ...(apiPatch.settingsPatch as Record<string, unknown>) },
      }));
    }
    setSaving(true);
    try {
      await onPatch(dashboard.id, apiPatch);
      flash("success", "Salvo");
    } catch {
      setLocalDash(prev);
      flash("error", "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  const metricsLink = `/metricas?clientId=${clientId}&period=last_7_days`;

  return (
    <div className="rounded-2xl border border-black/[0.08] bg-black/[0.02] overflow-hidden">
      {/* Dashboard header */}
      <div className="px-5 py-4 border-b border-black/[0.06]">
        <div className="flex items-center gap-3 flex-wrap">
          <LayoutDashboard size={14} className="text-vitti-light/40 shrink-0" />
          <p className="text-sm font-light text-[#111111]/90">{localDash.name ?? "Dashboard"}</p>
          <StatusPill status={localDash.status} />
          <div className="flex-1" />
          {feedback ? (
            <FeedbackLine {...feedback} />
          ) : saving ? (
            <Loader2 size={12} className="animate-spin text-[#5F6368]/60" />
          ) : null}
        </div>

        {/* Dashboard controls */}
        <div className="flex items-center gap-4 mt-3 flex-wrap">
          {/* Publish toggle */}
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-[#5F6368]/55 uppercase tracking-widest">Status</span>
            <button
              onClick={() =>
                patchDash({
                  status: localDash.status === "published" ? "draft" : "published",
                })
              }
              disabled={saving}
              className={cn(
                "text-[9px] font-light px-2.5 py-1 rounded-full border transition-all disabled:opacity-40",
                localDash.status === "published"
                  ? "border-emerald-500/25 text-emerald-400/70 hover:border-red-400/25 hover:text-red-400/60"
                  : "border-black/[0.08] text-[#5F6368]/60 hover:border-emerald-500/25 hover:text-emerald-400/60"
              )}
            >
              {localDash.status === "published" ? "Despublicar" : "Publicar"}
            </button>
          </div>

          {/* Default period */}
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-[#5F6368]/55 uppercase tracking-widest">Período padrão</span>
            <select
              value={defaultPeriod}
              onChange={(e) =>
                patchDash({ settingsPatch: { default_period: e.target.value } })
              }
              disabled={saving}
              className="text-[9px] font-light bg-black/[0.03] border border-black/[0.08] rounded px-2 py-1 text-[#5F6368]/80 focus:outline-none"
            >
              {PERIOD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* Compare previous period */}
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-[#5F6368]/55 uppercase tracking-widest">Comparar período anterior</span>
            <Toggle
              checked={comparePrev}
              onChange={(v) =>
                patchDash({ settingsPatch: { compare_previous_period: v } })
              }
              disabled={saving}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 mt-2.5">
          <span className="text-[9px] text-[#5F6368]/50">
            Canal: <span className="text-[#5F6368]/70">{localDash.default_channel ?? "—"}</span>
          </span>
          <span className="text-[9px] text-[#5F6368]/50">
            Blocos: <span className="text-[#5F6368]/70">{localDash.totalBlocks}</span>
          </span>
          <span className="text-[9px] text-[#5F6368]/50">
            Métricas: <span className="text-[#5F6368]/70">{localDash.totalMetrics}</span>
          </span>
          <a
            href={metricsLink}
            target="_blank"
            rel="noreferrer"
            className="ml-auto flex items-center gap-1 text-[9px] font-light text-vitti-light/50 hover:text-vitti-light/80 transition-colors"
          >
            Abrir /metricas
            <ExternalLink size={10} />
          </a>
        </div>
      </div>

      {/* Blocks */}
      <div className="px-5 py-4 space-y-2.5">
        {dashboard.blocks.length === 0 ? (
          <p className="text-[11px] text-[#5F6368]/50 font-light text-center py-4">
            Nenhum bloco configurado. Use &quot;Garantir dashboard padrão&quot; no painel de Clientes.
          </p>
        ) : (
          dashboard.blocks.map((block) => (
            <BlockCard
              key={block.id}
              block={block}
              onPatch={onPatchBlock}
              onPatchMetric={onPatchMetric}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── Client info section ───────────────────────────────────────────────────────

function ClientInfoSection({
  client,
}: {
  client: ClientDashboardConfig["client"];
}) {
  return (
    <div className="rounded-xl border border-black/[0.07] bg-black/[0.02] px-5 py-4 flex items-center gap-6 flex-wrap">
      <div>
        <p className="text-xs font-light text-[#111111]/80">{client.name}</p>
        <p className="text-[10px] font-mono text-[#5F6368]/60 mt-0.5">{client.slug}</p>
      </div>

      <div className="flex items-center gap-4 text-[10px] font-light text-[#5F6368]/65 flex-wrap">
        <span>
          Segmento:{" "}
          <span className="text-[#111111]/65">{client.segment ?? "—"}</span>
        </span>
        <span
          className={cn(
            "px-2 py-0.5 rounded-full border text-[9px]",
            client.status === "active"
              ? "border-emerald-500/20 text-emerald-400/70"
              : "border-black/[0.08] text-[#5F6368]/60"
          )}
        >
          {client.status === "active" ? "Ativo" : "Inativo"}
        </span>
        <span>
          Windsor:{" "}
          <span
            className={cn(
              client.windsorMappings > 0 ? "text-vitti-light/60" : "text-[#5F6368]/50"
            )}
          >
            {client.windsorMappings} mapeamento(s)
          </span>
        </span>
        <span>
          Performance:{" "}
          <span className="text-[#111111]/65">
            {client.performanceRecords.toLocaleString("pt-BR")} registros
          </span>
        </span>
      </div>

      <div className="ml-auto">
        <a
          href={`/metricas?clientId=${client.id}&period=last_7_days`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-vitti-blue/25 text-vitti-light/60 hover:text-vitti-light/90 hover:border-vitti-blue/50 text-[10px] font-light transition-all"
        >
          Abrir métricas do cliente
          <ExternalLink size={11} />
        </a>
      </div>
    </div>
  );
}

// ── Seção de Configurações Meta Ads ──────────────────────────────────────────

function MetaAdsConfigSection({
  config,
  onPatchBlock,
}: {
  config: ClientDashboardConfig;
  onPatchBlock: (id: string, patch: Record<string, unknown>) => Promise<void>;
}) {
  // Encontra o primeiro bloco meta_ads entre todos os dashboards do cliente
  const metaBlock = config.dashboards
    .flatMap((d) => d.blocks)
    .find((b) => b.channel === "meta_ads");

  const initialKeys = Array.isArray(metaBlock?.settings?.evolution_metrics)
    ? (metaBlock!.settings!.evolution_metrics as string[])
    : [];

  const [selectedKeys, setSelectedKeys] = useState<string[]>(initialKeys);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  if (!metaBlock) return null;
  // Re-atribuição para que closures abaixo enxerguem o tipo sem undefined
  const block = metaBlock;

  function flash(type: "success" | "error", msg: string) {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 3000);
  }

  async function toggleMetric(key: string) {
    const isSelected = selectedKeys.includes(key);
    if (!isSelected && selectedKeys.length >= 3) return; // máximo 3

    const next = isSelected
      ? selectedKeys.filter((k) => k !== key)
      : [...selectedKeys, key];

    const prev = selectedKeys;
    setSelectedKeys(next);
    setSaving(true);
    try {
      await onPatchBlock(block.id, {
        settingsPatch: { evolution_metrics: next },
      });
      flash("success", next.length === 0 ? "Usando padrão" : "Salvo");
    } catch {
      setSelectedKeys(prev);
      flash("error", "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  const atMax = selectedKeys.length >= 3;

  return (
    <div className="rounded-2xl border border-[#455cab]/15 bg-[#455cab]/[0.025] overflow-hidden">
      {/* Cabeçalho */}
      <div className="px-5 py-4 border-b border-[#455cab]/10 flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-[#455cab]/10 border border-[#455cab]/15 flex items-center justify-center shrink-0">
          <BarChart3 size={13} className="text-[#455cab]/60" />
        </div>
        <div>
          <p className="text-sm font-light text-[#455cab] tracking-wide">
            Configurações Meta Ads
          </p>
          <p className="text-[10px] text-[#5F6368]/45 mt-0.5 font-light">
            Configurações específicas para a aba Meta Ads deste cliente.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2 min-w-[80px] justify-end">
          {saving ? (
            <Loader2 size={12} className="animate-spin text-[#5F6368]/60" />
          ) : feedback ? (
            <FeedbackLine {...feedback} />
          ) : null}
        </div>
      </div>

      {/* Corpo */}
      <div className="px-5 py-5">
        {/* Campo: Métricas do gráfico de evolução */}
        <div>
          <div className="flex items-baseline gap-2 mb-1">
            <p className="text-[11px] font-light text-[#111111]/80">
              Métricas do gráfico de evolução
            </p>
            <span className="text-[9px] text-[#5F6368]/40 font-light">máx. 3</span>
          </div>
          <p className="text-[9px] text-[#5F6368]/45 font-light mb-3 leading-relaxed">
            Define quais métricas aparecem no gráfico &quot;Evolução no período&quot; da aba Meta Ads.
            <br />
            Se nenhuma selecionada, usa o padrão: Investimento + Mensagens ou Leads.
          </p>

          {/* Pills selecionáveis */}
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_EVOLUTION_METRICS.map((m) => {
              const selected = selectedKeys.includes(m.key);
              const locked = !selected && atMax;
              return (
                <button
                  key={m.key}
                  onClick={() => toggleMetric(m.key)}
                  disabled={saving || locked}
                  title={locked ? "Máximo de 3 métricas atingido" : undefined}
                  className={cn(
                    "flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-lg border transition-all",
                    selected
                      ? "bg-[#455cab]/10 border-[#455cab]/35 text-[#455cab] font-medium"
                      : locked
                      ? "bg-black/[0.015] border-black/[0.05] text-[#5F6368]/35 cursor-not-allowed"
                      : "bg-black/[0.02] border-black/[0.08] text-[#5F6368]/65 hover:border-[#455cab]/25 hover:text-[#5F6368]/85"
                  )}
                >
                  {selected && <Check size={9} className="shrink-0" />}
                  {m.label}
                </button>
              );
            })}
          </div>

          {/* Resumo e avisos */}
          <div className="mt-3 space-y-1">
            {selectedKeys.length > 0 ? (
              <p className="text-[9px] text-[#455cab]/60 font-light">
                Selecionadas:{" "}
                {selectedKeys
                  .map(
                    (k) =>
                      AVAILABLE_EVOLUTION_METRICS.find((m) => m.key === k)?.label ?? k
                  )
                  .join(", ")}
              </p>
            ) : (
              <p className="text-[9px] text-[#5F6368]/40 font-light">
                Nenhuma selecionada — usando padrão do sistema.
              </p>
            )}
            {atMax && (
              <p className="text-[9px] text-amber-600/55 font-light">
                Limite atingido. Desmarque uma métrica para selecionar outra.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function DashboardsAdminPanel({
  initialClients,
  initialConfig,
  initialClientId,
}: {
  initialClients: AdminClientRow[];
  initialConfig: ClientDashboardConfig | null;
  initialClientId: string | null;
}) {
  const [selectedId, setSelectedId] = useState<string>(initialClientId ?? "");
  const [config, setConfig] = useState<ClientDashboardConfig | null>(initialConfig);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchConfig = useCallback(async (clientId: string) => {
    if (!clientId) { setConfig(null); return; }
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/admin/dashboards?clientId=${clientId}`);
      const json: DashboardsApiResponse = await res.json();
      if (json.success && json.config) {
        setConfig(json.config);
      } else {
        setConfig(null);
        setLoadError(json.error ?? "Erro ao carregar configuração.");
      }
    } catch {
      setConfig(null);
      setLoadError("Erro de conexão.");
    } finally {
      setLoading(false);
    }
  }, []);

  function handleClientChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    setSelectedId(id);
    fetchConfig(id);
  }

  // ── Generic PATCH helpers ─────────────────────────────────────────────────

  const patchDashboard = useCallback(async (id: string, patch: Record<string, unknown>) => {
    const res = await fetch(`/api/admin/dashboards/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.detail ?? json.error ?? "Erro");
  }, []);

  const patchBlock = useCallback(async (id: string, patch: Record<string, unknown>) => {
    const res = await fetch(`/api/admin/dashboard-blocks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.detail ?? json.error ?? "Erro");
  }, []);

  const patchMetric = useCallback(async (id: string, patch: Record<string, unknown>) => {
    const res = await fetch(`/api/admin/dashboard-block-metrics/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.detail ?? json.error ?? "Erro");
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Client selector */}
      <div className="flex items-center gap-3">
        <label className="text-[10px] text-[#5F6368]/60 uppercase tracking-widest shrink-0">
          Cliente
        </label>
        <select
          value={selectedId}
          onChange={handleClientChange}
          className="bg-black/[0.03] border border-black/[0.08] rounded-lg px-3 py-2 text-[11px] font-light text-[#111111]/80 focus:outline-none focus:border-vitti-blue/30 transition-colors min-w-56"
        >
          <option value="">Selecionar cliente…</option>
          {initialClients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.status !== "active" ? " (inativo)" : ""}
            </option>
          ))}
        </select>

        {loading && <Loader2 size={13} className="animate-spin text-[#5F6368]/60" />}
      </div>

      {/* Error */}
      {loadError && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/15 bg-red-500/[0.04] px-4 py-3">
          <AlertCircle size={13} className="text-red-400/50 shrink-0" />
          <p className="text-[11px] font-light text-red-400/60">{loadError}</p>
        </div>
      )}

      {/* Empty state */}
      {!selectedId && !loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-2 rounded-xl border border-dashed border-black/[0.06]">
          <LayoutDashboard size={20} className="text-[#5F6368]/25" />
          <p className="text-[11px] text-[#5F6368]/50 font-light">
            Selecione um cliente para visualizar os dashboards
          </p>
        </div>
      )}

      {/* Config loaded */}
      {config && !loading && (
        <div className="space-y-5">
          <ClientInfoSection client={config.client} />

          {/* Configurações específicas por canal — aparece antes dos blocos */}
          <MetaAdsConfigSection
            key={config.client.id}
            config={config}
            onPatchBlock={patchBlock}
          />

          {config.dashboards.length === 0 ? (
            <div className="rounded-xl border border-dashed border-black/[0.06] px-5 py-10 text-center">
              <p className="text-[11px] text-[#5F6368]/50 font-light">
                Nenhum dashboard configurado para este cliente.
              </p>
              <p className="text-[10px] text-[#5F6368]/35 mt-1 font-light">
                Acesse Admin → Clientes e use &quot;Garantir dashboard padrão&quot;.
              </p>
            </div>
          ) : (
            config.dashboards.map((dash) => (
              <DashboardCard
                key={dash.id}
                dashboard={dash}
                clientId={config.client.id}
                onPatch={patchDashboard}
                onPatchBlock={patchBlock}
                onPatchMetric={patchMetric}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function BackToAdmin() {
  return (
    <a
      href="/admin"
      className="inline-flex items-center gap-1.5 text-[10px] font-light text-[#5F6368]/60 hover:text-[#111111]/75 transition-colors"
    >
      <ChevronLeft size={12} />
      Admin
    </a>
  );
}

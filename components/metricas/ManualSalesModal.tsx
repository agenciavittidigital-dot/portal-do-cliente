"use client";

import { useState, useEffect } from "react";
import { X, Plus, Pencil, Trash2, Loader2, ChevronLeft, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ManualSale {
  id: string;
  date: string;
  channel: string;
  campaign_id: string | null;
  campaign_name: string | null;
  purchases: number;
  purchase_value: number;
  notes: string | null;
  created_by_name: string;
  created_at: string;
}

interface CampaignOption {
  campaign_id: string;
  campaign_name: string | null;
}

export interface ManualSalesModalProps {
  open: boolean;
  onClose: () => void;
  clientId: string;
  channel: "meta_ads" | "google_ads";
  onDataChange: () => void;
}

type ModalMode = "list" | "add" | "edit";

interface FormState {
  date: string;
  campaign_id: string;
  campaign_name: string;
  purchases: string;
  purchase_value: string;
  notes: string;
}

const TODAY = new Date().toISOString().slice(0, 10);

const EMPTY_FORM: FormState = {
  date: TODAY,
  campaign_id: "",
  campaign_name: "",
  purchases: "1",
  purchase_value: "",
  notes: "",
};

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function fmtCurrency(v: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v);
}

export function ManualSalesModal({
  open,
  onClose,
  clientId,
  channel,
  onDataChange,
}: ManualSalesModalProps) {
  const [mode, setMode] = useState<ModalMode>("list");
  const [sales, setSales] = useState<ManualSale[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [salesLoading, setSalesLoading] = useState(false);
  const [formSaving, setFormSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });

  const channelLabel = channel === "meta_ads" ? "Meta Ads" : "Google Ads";

  useEffect(() => {
    if (!open) {
      setMode("list");
      setConfirmDeleteId(null);
      setFormError(null);
      setListError(null);
      setEditingId(null);
      return;
    }
    fetchSales();
    fetchCampaigns();
  }, [open, clientId, channel]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchSales() {
    setSalesLoading(true);
    setListError(null);
    try {
      const res = await fetch(
        `/api/admin/clients/${clientId}/manual-sales?channel=${channel}`
      );
      const data = await res.json() as {
        success: boolean;
        sales?: ManualSale[];
        error?: string;
      };
      if (!data.success) {
        setListError(data.error ?? "Erro ao carregar vendas.");
      } else {
        setSales(data.sales ?? []);
      }
    } catch {
      setListError("Erro de conexão.");
    } finally {
      setSalesLoading(false);
    }
  }

  async function fetchCampaigns() {
    try {
      const res = await fetch(
        `/api/admin/clients/${clientId}/manual-sales/campaigns?channel=${channel}`
      );
      const data = await res.json() as {
        success: boolean;
        campaigns?: CampaignOption[];
      };
      if (data.success) setCampaigns(data.campaigns ?? []);
    } catch {
      // Silencioso — dropdown de campanhas é opcional
    }
  }

  function openAdd() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, date: new Date().toISOString().slice(0, 10) });
    setFormError(null);
    setMode("add");
  }

  function openEdit(sale: ManualSale) {
    setEditingId(sale.id);
    setForm({
      date: sale.date,
      campaign_id: sale.campaign_id ?? "",
      campaign_name: sale.campaign_name ?? "",
      purchases: String(sale.purchases),
      purchase_value: String(sale.purchase_value),
      notes: sale.notes ?? "",
    });
    setFormError(null);
    setMode("edit");
  }

  function backToList() {
    setMode("list");
    setEditingId(null);
    setFormError(null);
  }

  function handleCampaignSelect(campaignId: string) {
    const found = campaigns.find((c) => c.campaign_id === campaignId);
    setForm((prev) => ({
      ...prev,
      campaign_id: campaignId,
      campaign_name: found?.campaign_name ?? prev.campaign_name,
    }));
  }

  async function handleSave() {
    setFormError(null);

    const purchases = parseInt(form.purchases, 10);
    const purchase_value = parseFloat(form.purchase_value.replace(",", "."));

    if (!form.date) return setFormError("Data é obrigatória.");
    if (!Number.isInteger(purchases) || purchases < 1)
      return setFormError("Quantidade deve ser um número inteiro maior que zero.");
    if (!isFinite(purchase_value) || purchase_value <= 0)
      return setFormError("Valor deve ser maior que zero.");

    setFormSaving(true);
    const body = {
      channel,
      date: form.date,
      campaign_id: form.campaign_id.trim() || null,
      campaign_name: form.campaign_name.trim() || null,
      purchases,
      purchase_value,
      notes: form.notes.trim() || null,
    };

    try {
      const url =
        mode === "add"
          ? `/api/admin/clients/${clientId}/manual-sales`
          : `/api/admin/clients/${clientId}/manual-sales/${editingId}`;
      const method = mode === "add" ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { success: boolean; error?: string };

      if (!data.success) {
        setFormError(data.error ?? "Erro ao salvar.");
        return;
      }

      await fetchSales();
      onDataChange();
      backToList();
    } catch {
      setFormError("Erro de conexão.");
    } finally {
      setFormSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(
        `/api/admin/clients/${clientId}/manual-sales/${id}`,
        { method: "DELETE" }
      );
      const data = await res.json() as { success: boolean; error?: string };
      if (!data.success) {
        setListError(data.error ?? "Erro ao excluir.");
      } else {
        setSales((prev) => prev.filter((s) => s.id !== id));
        onDataChange();
      }
    } catch {
      setListError("Erro de conexão ao excluir.");
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Card */}
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200/60 flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            {mode !== "list" && (
              <button
                onClick={backToList}
                className="p-1 rounded-md hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600"
                aria-label="Voltar"
              >
                <ChevronLeft size={14} />
              </button>
            )}
            <div>
              <h3 className="text-sm font-light text-[#171f38] tracking-wide">
                {mode === "list"
                  ? `Vendas manuais — ${channelLabel}`
                  : mode === "add"
                  ? "Nova venda manual"
                  : "Editar venda manual"}
              </h3>
              {mode === "list" && (
                <p className="text-[10px] text-[#171f38]/40 font-light mt-0.5">
                  Origem: registros manuais · não sincronizados com a plataforma
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600"
            aria-label="Fechar"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {mode === "list" ? (
            <ListContent
              sales={sales}
              loading={salesLoading}
              error={listError}
              deletingId={deletingId}
              confirmDeleteId={confirmDeleteId}
              onAddClick={openAdd}
              onEditClick={openEdit}
              onDeleteClick={(id) => setConfirmDeleteId(id)}
              onDeleteConfirm={handleDelete}
              onDeleteCancel={() => setConfirmDeleteId(null)}
            />
          ) : (
            <FormContent
              form={form}
              campaigns={campaigns}
              saving={formSaving}
              error={formError}
              onFieldChange={(k, v) => setForm((prev) => ({ ...prev, [k]: v }))}
              onCampaignSelect={handleCampaignSelect}
              onSave={handleSave}
              onCancel={backToList}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Lista de vendas manuais ───────────────────────────────────────────────────

interface ListContentProps {
  sales: ManualSale[];
  loading: boolean;
  error: string | null;
  deletingId: string | null;
  confirmDeleteId: string | null;
  onAddClick: () => void;
  onEditClick: (sale: ManualSale) => void;
  onDeleteClick: (id: string) => void;
  onDeleteConfirm: (id: string) => void;
  onDeleteCancel: () => void;
}

function ListContent({
  sales,
  loading,
  error,
  deletingId,
  confirmDeleteId,
  onAddClick,
  onEditClick,
  onDeleteClick,
  onDeleteConfirm,
  onDeleteCancel,
}: ListContentProps) {
  return (
    <div className="p-5 space-y-4">
      {/* Aviso de duplicidade */}
      <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-amber-50 border border-amber-200/70">
        <AlertTriangle size={13} className="text-amber-500 shrink-0 mt-0.5" />
        <p className="text-[11px] font-light text-amber-700 leading-relaxed">
          Caso esta conversão seja posteriormente registrada automaticamente
          pela plataforma, remova este lançamento manual para evitar
          duplicidade.
        </p>
      </div>

      {/* Ação de adicionar */}
      <div className="flex justify-end">
        <button
          onClick={onAddClick}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#171f38] text-[11px] font-light text-white hover:bg-[#1e2a47] transition-colors"
        >
          <Plus size={11} />
          Adicionar venda
        </button>
      </div>

      {/* Estados de carregamento / erro */}
      {loading && (
        <div className="flex items-center justify-center py-8 gap-2 text-slate-400">
          <Loader2 size={14} className="animate-spin" />
          <span className="text-[11px] font-light">Carregando...</span>
        </div>
      )}

      {error && !loading && (
        <p className="text-[11px] font-light text-red-400 text-center py-4">
          {error}
        </p>
      )}

      {/* Lista vazia */}
      {!loading && !error && sales.length === 0 && (
        <p className="text-[11px] font-light text-slate-400 text-center py-8">
          Nenhuma venda manual cadastrada.
        </p>
      )}

      {/* Tabela de vendas */}
      {!loading && sales.length > 0 && (
        <div className="rounded-xl border border-slate-200/70 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/60">
                <th className="px-3 py-2.5 text-[9px] font-medium text-[#171f38]/45 tracking-wider uppercase">
                  Data
                </th>
                <th className="px-3 py-2.5 text-[9px] font-medium text-[#171f38]/45 tracking-wider uppercase">
                  Campanha
                </th>
                <th className="px-3 py-2.5 text-[9px] font-medium text-[#171f38]/45 tracking-wider uppercase text-right">
                  Vendas
                </th>
                <th className="px-3 py-2.5 text-[9px] font-medium text-[#171f38]/45 tracking-wider uppercase text-right">
                  Valor
                </th>
                <th className="px-3 py-2.5 text-[9px] font-medium text-[#171f38]/45 tracking-wider uppercase">
                  Obs.
                </th>
                <th className="px-3 py-2.5 text-[9px] font-medium text-[#171f38]/45 tracking-wider uppercase">
                  Origem
                </th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {sales.map((sale, idx) => {
                const isLast = idx === sales.length - 1;
                const isConfirming = confirmDeleteId === sale.id;
                const isDeleting = deletingId === sale.id;

                return (
                  <tr
                    key={sale.id}
                    className={cn(
                      "transition-colors",
                      !isLast && "border-b border-slate-100",
                      isConfirming ? "bg-red-50/60" : "hover:bg-slate-50/60"
                    )}
                  >
                    <td className="px-3 py-2.5 text-[11px] font-light text-[#171f38]/80 whitespace-nowrap">
                      {fmtDate(sale.date)}
                    </td>
                    <td className="px-3 py-2.5 text-[11px] font-light text-[#171f38]/70 max-w-[140px] truncate">
                      {sale.campaign_name ?? sale.campaign_id ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-[11px] font-light text-[#171f38]/80 text-right tabular-nums">
                      {sale.purchases}
                    </td>
                    <td className="px-3 py-2.5 text-[11px] font-light text-[#455cab] text-right tabular-nums whitespace-nowrap">
                      {fmtCurrency(sale.purchase_value)}
                    </td>
                    <td className="px-3 py-2.5 text-[10px] font-light text-[#171f38]/50 max-w-[120px] truncate">
                      {sale.notes ?? "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/60 text-[8px] font-medium text-emerald-600 uppercase tracking-wide">
                        manual
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {isConfirming ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => onDeleteConfirm(sale.id)}
                            disabled={isDeleting}
                            className="text-[10px] font-light text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
                          >
                            {isDeleting ? (
                              <Loader2 size={11} className="animate-spin" />
                            ) : (
                              "Confirmar"
                            )}
                          </button>
                          <span className="text-slate-300">·</span>
                          <button
                            onClick={onDeleteCancel}
                            disabled={isDeleting}
                            className="text-[10px] font-light text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => onEditClick(sale)}
                            className="p-1 rounded hover:bg-slate-100 transition-colors text-slate-400 hover:text-[#455cab]"
                            aria-label="Editar"
                          >
                            <Pencil size={11} />
                          </button>
                          <button
                            onClick={() => onDeleteClick(sale.id)}
                            className="p-1 rounded hover:bg-red-50 transition-colors text-slate-400 hover:text-red-500"
                            aria-label="Excluir"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Formulário de adição/edição ───────────────────────────────────────────────

interface FormContentProps {
  form: FormState;
  campaigns: CampaignOption[];
  saving: boolean;
  error: string | null;
  onFieldChange: (key: keyof FormState, value: string) => void;
  onCampaignSelect: (campaignId: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

function FormContent({
  form,
  campaigns,
  saving,
  error,
  onFieldChange,
  onCampaignSelect,
  onSave,
  onCancel,
}: FormContentProps) {
  return (
    <div className="p-5 space-y-4">
      {/* Aviso de duplicidade */}
      <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-amber-50 border border-amber-200/70">
        <AlertTriangle size={13} className="text-amber-500 shrink-0 mt-0.5" />
        <p className="text-[11px] font-light text-amber-700 leading-relaxed">
          Caso esta conversão seja posteriormente registrada automaticamente
          pela plataforma, remova este lançamento manual para evitar
          duplicidade.
        </p>
      </div>

      <div className="space-y-3">
        {/* Data */}
        <div>
          <label className="block text-[10px] font-medium text-[#171f38]/50 tracking-wider uppercase mb-1">
            Data *
          </label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => onFieldChange("date", e.target.value)}
            className="w-full text-[12px] font-light text-[#171f38] border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-[#455cab]/30 focus:border-[#455cab]/40"
          />
        </div>

        {/* Campanha */}
        <div>
          <label className="block text-[10px] font-medium text-[#171f38]/50 tracking-wider uppercase mb-1">
            Campanha
          </label>
          {campaigns.length > 0 ? (
            <select
              value={form.campaign_id}
              onChange={(e) => onCampaignSelect(e.target.value)}
              className="w-full text-[12px] font-light text-[#171f38] border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-[#455cab]/30 focus:border-[#455cab]/40 appearance-none"
            >
              <option value="">Sem campanha específica</option>
              {campaigns.map((c) => (
                <option key={c.campaign_id} value={c.campaign_id}>
                  {c.campaign_name ?? c.campaign_id}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={form.campaign_name}
              onChange={(e) => onFieldChange("campaign_name", e.target.value)}
              placeholder="Nome da campanha (opcional)"
              className="w-full text-[12px] font-light text-[#171f38] border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-[#455cab]/30 focus:border-[#455cab]/40 placeholder:text-[#171f38]/25"
            />
          )}
        </div>

        {/* Quantidade e Valor lado a lado */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-medium text-[#171f38]/50 tracking-wider uppercase mb-1">
              Qtd. de vendas *
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={form.purchases}
              onChange={(e) => onFieldChange("purchases", e.target.value)}
              className="w-full text-[12px] font-light text-[#171f38] border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-[#455cab]/30 focus:border-[#455cab]/40"
            />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-[#171f38]/50 tracking-wider uppercase mb-1">
              Valor total (R$) *
            </label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={form.purchase_value}
              onChange={(e) => onFieldChange("purchase_value", e.target.value)}
              placeholder="0,00"
              className="w-full text-[12px] font-light text-[#171f38] border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-[#455cab]/30 focus:border-[#455cab]/40 placeholder:text-[#171f38]/25"
            />
          </div>
        </div>

        {/* Observação */}
        <div>
          <label className="block text-[10px] font-medium text-[#171f38]/50 tracking-wider uppercase mb-1">
            Observação
          </label>
          <textarea
            value={form.notes}
            onChange={(e) => onFieldChange("notes", e.target.value)}
            placeholder="Informações adicionais sobre esta venda (opcional)"
            rows={2}
            className="w-full text-[12px] font-light text-[#171f38] border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-[#455cab]/30 focus:border-[#455cab]/40 placeholder:text-[#171f38]/25 resize-none"
          />
        </div>
      </div>

      {/* Erro do formulário */}
      {error && (
        <p className="text-[11px] font-light text-red-400">{error}</p>
      )}

      {/* Ações */}
      <div className="flex justify-end gap-2 pt-1">
        <button
          onClick={onCancel}
          disabled={saving}
          className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-[11px] font-light text-[#171f38]/60 hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#455cab] text-[11px] font-light text-white hover:bg-[#3a4f99] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving && <Loader2 size={10} className="animate-spin" />}
          {saving ? "Salvando..." : "Salvar venda"}
        </button>
      </div>
    </div>
  );
}

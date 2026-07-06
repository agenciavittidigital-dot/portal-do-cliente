"use client";

import { useState, useEffect } from "react";
import { X, Loader2, Save, Trash2, Paperclip, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface CategoryOption { id: string; name: string; color: string }
interface StatusOption   { id: string; name: string; color: string }
interface ClientOption   { id: string; name: string }
interface ResponsibleOption { id: string; name: string }

export interface DrawerEditItem {
  id: string;
  clientId: string;
  categoryId: string | null;
  statusId: string | null;
  responsibleId: string | null;
  title: string;
  description: string | null;
  caption: string | null;
  scheduledAt: string | null;
  deliveryAt: string | null;
}

interface ContentDrawerProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  categories: CategoryOption[];
  statuses: StatusOption[];
  clients: ClientOption[];
  responsibles: ResponsibleOption[];
  editItem?: DrawerEditItem | null;
  initialScheduledAt?: string;
}

interface FormState {
  categoryId: string;
  clientId: string;
  responsibleId: string;
  title: string;
  description: string;
  caption: string;
  scheduledAt: string;
  deliveryAt: string;
  statusId: string;
}

const EMPTY: FormState = {
  categoryId: "",
  clientId: "",
  responsibleId: "",
  title: "",
  description: "",
  caption: "",
  scheduledAt: "",
  deliveryAt: "",
  statusId: "",
};

function isoToDatetimeLocal(iso: string): string {
  try {
    const d = new Date(iso);
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
  } catch {
    return iso.slice(0, 16);
  }
}

export function ContentDrawer({
  open,
  onClose,
  onSaved,
  categories,
  statuses,
  clients,
  responsibles,
  editItem,
  initialScheduledAt,
}: ContentDrawerProps) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!editItem;

  useEffect(() => {
    if (!open) return;
    setError(null);

    if (editItem) {
      setForm({
        categoryId:    editItem.categoryId    ?? "",
        clientId:      editItem.clientId      ?? "",
        responsibleId: editItem.responsibleId ?? "",
        title:         editItem.title         ?? "",
        description:   editItem.description   ?? "",
        caption:       editItem.caption       ?? "",
        scheduledAt:   editItem.scheduledAt
          ? isoToDatetimeLocal(editItem.scheduledAt)
          : "",
        deliveryAt: editItem.deliveryAt ?? "",
        statusId:   editItem.statusId   ?? "",
      });
    } else {
      setForm({
        ...EMPTY,
        scheduledAt: initialScheduledAt ? `${initialScheduledAt}T09:00` : "",
      });
    }
  }, [open, editItem, initialScheduledAt]);

  function set(key: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setError("O título é obrigatório."); return; }
    if (!form.clientId)     { setError("Selecione um cliente."); return; }

    setLoading(true);
    setError(null);

    const payload = {
      client_id:      form.clientId,
      category_id:    form.categoryId    || null,
      status_id:      form.statusId      || null,
      responsible_id: form.responsibleId || null,
      title:          form.title.trim(),
      description:    form.description.trim() || null,
      caption:        form.caption.trim()     || null,
      scheduled_at:   form.scheduledAt
        ? new Date(form.scheduledAt).toISOString()
        : null,
      delivery_at: form.deliveryAt || null,
    };

    try {
      const url = isEditing
        ? `/api/admin/editorial/${editItem!.id}`
        : "/api/admin/editorial";
      const res = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json() as {
        success: boolean;
        error?: string;
        detail?: string;
      };

      if (!res.ok || !data.success) {
        const msg = [data.error, data.detail].filter(Boolean).join(" — ");
        setError(msg || "Erro ao salvar conteúdo.");
      } else {
        onSaved();
      }
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!isEditing || !editItem) return;
    if (!confirm("Excluir este conteúdo definitivamente?")) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/editorial/${editItem.id}`, {
        method: "DELETE",
      });
      const data = await res.json() as { success: boolean; error?: string };

      if (!res.ok || !data.success) {
        setError(data.error ?? "Erro ao excluir.");
      } else {
        onSaved();
      }
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full text-xs font-light text-vitti-fg border border-black/[0.1] rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-vitti-blue/30 placeholder:text-vitti-fg-muted/35";
  const labelClass =
    "block text-[10px] font-medium text-vitti-fg-muted/65 uppercase tracking-wide mb-1.5";
  const disabledAreaClass =
    "w-full flex items-start gap-2 border border-dashed border-black/[0.1] rounded-lg px-3 py-2.5 bg-black/[0.015] text-vitti-fg-muted/40 cursor-not-allowed";

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/15 backdrop-blur-[2px]"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={cn(
          "fixed top-0 right-0 z-50 h-full w-[420px] bg-white flex flex-col",
          "shadow-[-8px_0_40px_rgba(0,0,0,0.12)]",
          "transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06] shrink-0">
          <h3 className="text-sm font-light text-vitti-blue tracking-wide">
            {isEditing ? "Editar conteúdo" : "Novo conteúdo"}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-vitti-fg-muted/40 hover:bg-black/[0.04] hover:text-vitti-fg transition-all"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="flex flex-col flex-1 overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">

            {/* 1. Categoria */}
            <div>
              <label className={labelClass}>Categoria</label>
              <select
                value={form.categoryId}
                onChange={(e) => set("categoryId", e.target.value)}
                className={inputClass}
              >
                <option value="">Sem categoria</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* 2. Cliente */}
            <div>
              <label className={labelClass}>Cliente *</label>
              <select
                value={form.clientId}
                onChange={(e) => set("clientId", e.target.value)}
                className={inputClass}
              >
                <option value="">Selecionar cliente</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* 3. Responsável */}
            {responsibles.length > 0 && (
              <div>
                <label className={labelClass}>Responsável</label>
                <select
                  value={form.responsibleId}
                  onChange={(e) => set("responsibleId", e.target.value)}
                  className={inputClass}
                >
                  <option value="">Sem responsável</option>
                  {responsibles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* 4. Título */}
            <div>
              <label className={labelClass}>Título *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="Ex: Post sobre lançamento do produto X"
                className={inputClass}
              />
            </div>

            {/* 5. Descrição */}
            <div>
              <label className={labelClass}>Descrição</label>
              <textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Briefing ou contexto do conteúdo..."
                rows={3}
                className={cn(inputClass, "resize-none")}
              />
            </div>

            {/* 6. Legenda */}
            <div>
              <label className={labelClass}>Legenda</label>
              <textarea
                value={form.caption}
                onChange={(e) => set("caption", e.target.value)}
                placeholder="Texto para publicação na rede social..."
                rows={3}
                className={cn(inputClass, "resize-none")}
              />
            </div>

            {/* 7 + 8. Datas */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Data e hora da postagem</label>
                <input
                  type="datetime-local"
                  value={form.scheduledAt}
                  onChange={(e) => set("scheduledAt", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Data de entrega</label>
                <input
                  type="date"
                  value={form.deliveryAt}
                  onChange={(e) => set("deliveryAt", e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            {/* 9. Arquivo (visual placeholder) */}
            <div>
              <label className={labelClass}>Arquivo</label>
              <div className={disabledAreaClass}>
                <Paperclip size={13} className="mt-0.5 shrink-0" />
                <span className="text-xs font-light italic">
                  Upload de arquivo (em breve)
                </span>
              </div>
            </div>

            {/* 10. Considerações (visual placeholder) */}
            <div>
              <label className={labelClass}>Considerações</label>
              <div className={cn(disabledAreaClass, "min-h-[52px]")}>
                <MessageSquare size={13} className="mt-0.5 shrink-0" />
                <span className="text-xs font-light italic">
                  Chat de considerações (em breve)
                </span>
              </div>
            </div>

            {/* 11. Status */}
            <div>
              <label className={labelClass}>Status</label>
              <select
                value={form.statusId}
                onChange={(e) => set("statusId", e.target.value)}
                className={inputClass}
              >
                <option value="">Sem status</option>
                {statuses.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Error */}
            {error && (
              <p className="text-[11px] text-red-500 font-light bg-red-50 px-3 py-2 rounded-lg border border-red-100">
                {error}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-black/[0.06] shrink-0 bg-white">
            {isEditing ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-[11px] font-light text-red-400 hover:bg-red-50 hover:text-red-500 transition-all disabled:opacity-40"
              >
                <Trash2 size={11} />
                Excluir
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-3.5 py-2 rounded-lg border border-black/[0.1] text-[11px] font-light text-vitti-fg-muted hover:bg-black/[0.02] transition-all disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-vitti-blue text-white text-[11px] font-light hover:bg-vitti-blue/90 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <Save size={11} />
                )}
                {isEditing ? "Salvar" : "Criar"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}

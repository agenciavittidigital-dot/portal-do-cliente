"use client";

import { useState, useEffect, useRef } from "react";
import {
  X,
  Loader2,
  Save,
  Trash2,
  Paperclip,
  MessageSquare,
  Download,
  Link2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CategoryOption { id: string; name: string; color: string }
interface StatusOption   { id: string; name: string; color: string }
interface ClientOption   { id: string; name: string }
interface ResponsibleOption { id: string; name: string }

interface AttachmentItem {
  id: string;
  fileName: string;
  fileSize: number;
  url: string | null;
  uploadedAt: string;
}

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
  videoUrl: string | null;
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
  videoUrl: string;
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
  videoUrl: "",
};

// Video MIME types and extensions that should NOT be uploaded
const VIDEO_MIME_PREFIXES = ["video/"];
const VIDEO_EXTENSIONS = /\.(mp4|mov|avi|mkv|wmv|flv|webm|m4v|mpg|mpeg|m2v)$/i;

function isVideoFile(file: File): boolean {
  return (
    VIDEO_MIME_PREFIXES.some((p) => file.type.startsWith(p)) ||
    VIDEO_EXTENSIONS.test(file.name)
  );
}

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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
  // Multiple pending files for cards/carrossel
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<AttachmentItem[]>([]);
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEditing = !!editItem;

  useEffect(() => {
    if (!open) {
      setPendingFiles([]);
      setExistingAttachments([]);
      setError(null);
      return;
    }
    setError(null);
    setPendingFiles([]);

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
        videoUrl:   editItem.videoUrl   ?? "",
      });
      // Fetch existing attachments
      fetch(`/api/admin/editorial/${editItem.id}/attachments`)
        .then((r) => r.json())
        .then((d) => {
          if (d.success) setExistingAttachments(d.attachments ?? []);
        })
        .catch(() => {});
    } else {
      setForm({
        ...EMPTY,
        scheduledAt: initialScheduledAt ? `${initialScheduledAt}T09:00` : "",
      });
      setExistingAttachments([]);
    }
  }, [open, editItem, initialScheduledAt]);

  function set(key: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // reset so same file can be re-selected

    const videos = files.filter(isVideoFile);
    if (videos.length > 0) {
      setError(
        'Para vídeos, adicione o link no campo "Link do vídeo". O upload é apenas para cards/imagens.'
      );
      return;
    }

    setError(null);
    setPendingFiles((prev) => [...prev, ...files]);
  }

  function removePendingFile(index: number) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleDeleteAttachment(attachmentId: string) {
    if (!editItem?.id) return;
    setDeletingAttachmentId(attachmentId);
    try {
      const res = await fetch(
        `/api/admin/editorial/${editItem.id}/attachments?attachmentId=${attachmentId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setExistingAttachments((prev) =>
          prev.filter((a) => a.id !== attachmentId)
        );
      }
    } catch { /* ignore */ } finally {
      setDeletingAttachmentId(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setError("O título é obrigatório."); return; }
    if (!form.clientId)     { setError("Selecione um cliente."); return; }

    // Validate video URL if filled
    const videoUrl = form.videoUrl.trim();
    if (videoUrl && !/^https?:\/\/.+/.test(videoUrl)) {
      setError("O link do vídeo deve começar com http:// ou https://");
      return;
    }

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
      video_url:   videoUrl || null,
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
        id?: string;
      };

      if (!res.ok || !data.success) {
        const msg = [data.error, data.detail].filter(Boolean).join(" — ");
        setError(msg || "Erro ao salvar conteúdo.");
        setLoading(false);
        return;
      }

      const contentId = isEditing ? editItem!.id : String(data.id ?? "");

      // Upload all pending cards/images in parallel
      if (pendingFiles.length > 0 && contentId) {
        const uploadErrors: string[] = [];

        await Promise.all(
          pendingFiles.map(async (file, idx) => {
            const fd = new FormData();
            fd.append("file", file);
            fd.append("position", String(idx));
            try {
              const uploadRes = await fetch(
                `/api/admin/editorial/${contentId}/attachments`,
                { method: "POST", body: fd }
              );
              const uploadData = await uploadRes.json() as {
                success: boolean;
                error?: string;
              };
              if (!uploadRes.ok || !uploadData.success) {
                uploadErrors.push(file.name);
              }
            } catch {
              uploadErrors.push(file.name);
            }
          })
        );

        if (uploadErrors.length > 0) {
          setError(
            `Conteúdo salvo. Falha ao enviar: ${uploadErrors.join(", ")}. Você pode adicioná-los ao editar.`
          );
          setLoading(false);
          return;
        }
      }

      onSaved();
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
                <label className={labelClass}>Data de entrega</label>
                <input
                  type="date"
                  value={form.deliveryAt}
                  onChange={(e) => set("deliveryAt", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Data e hora da postagem</label>
                <input
                  type="datetime-local"
                  value={form.scheduledAt}
                  onChange={(e) => set("scheduledAt", e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            {/* 9. Link do vídeo */}
            <div>
              <label className={labelClass}>Link do vídeo</label>
              <div className="relative">
                <Link2
                  size={12}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-vitti-fg-muted/40 pointer-events-none"
                />
                <input
                  type="url"
                  value={form.videoUrl}
                  onChange={(e) => set("videoUrl", e.target.value)}
                  placeholder="https://drive.google.com/... ou YouTube, Vimeo, CapCut..."
                  className={cn(inputClass, "pl-8")}
                />
              </div>
              <p className="text-[10px] text-vitti-fg-muted/45 mt-1 font-light">
                Google Drive, YouTube, Vimeo, CapCut, Frame.io ou qualquer link http/https
              </p>
            </div>

            {/* 10. Cards / imagens */}
            <div>
              <label className={labelClass}>Cards / imagens</label>

              {/* Existing attachments (edit mode) */}
              {existingAttachments.length > 0 && (
                <div className="mb-2 space-y-1.5">
                  {existingAttachments.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-vitti-blue/[0.04] border border-vitti-blue/[0.08]"
                    >
                      <Paperclip size={11} className="text-vitti-blue/50 shrink-0" />
                      <span className="text-xs font-light text-vitti-fg flex-1 truncate">
                        {att.fileName}
                      </span>
                      <span className="text-[10px] text-vitti-fg-muted/50 shrink-0">
                        {formatBytes(att.fileSize)}
                      </span>
                      {att.url && (
                        <a
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 rounded hover:bg-vitti-blue/10 text-vitti-blue/60 hover:text-vitti-blue transition-colors shrink-0"
                          title="Baixar"
                        >
                          <Download size={11} />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteAttachment(att.id)}
                        disabled={deletingAttachmentId === att.id}
                        className="p-1 rounded hover:bg-red-50 text-vitti-fg-muted/30 hover:text-red-400 transition-colors shrink-0 disabled:opacity-40"
                        title="Remover"
                      >
                        {deletingAttachmentId === att.id ? (
                          <Loader2 size={10} className="animate-spin" />
                        ) : (
                          <X size={10} />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Pending files preview */}
              {pendingFiles.length > 0 && (
                <div className="mb-2 space-y-1.5">
                  {pendingFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-vitti-blue/20 bg-vitti-blue/[0.03]"
                    >
                      <Paperclip size={11} className="text-vitti-blue/50 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-light text-vitti-fg truncate">
                          {file.name}
                        </div>
                        <div className="text-[10px] text-vitti-fg-muted/50">
                          {formatBytes(file.size)} · Será enviado ao salvar
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removePendingFile(idx)}
                        className="p-1 rounded hover:bg-black/[0.04] text-vitti-fg-muted/40 hover:text-red-400 transition-all shrink-0"
                        title="Remover"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add files button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center gap-2 border border-dashed border-black/[0.15] rounded-lg px-3 py-2.5 hover:border-vitti-blue/30 hover:bg-vitti-blue/[0.02] transition-all group"
              >
                <Paperclip
                  size={13}
                  className="text-vitti-fg-muted/40 group-hover:text-vitti-blue/50 transition-colors shrink-0"
                />
                <span className="text-xs font-light text-vitti-fg-muted/50 group-hover:text-vitti-blue/60 transition-colors">
                  {pendingFiles.length > 0 || existingAttachments.length > 0
                    ? "Adicionar mais cards / imagens"
                    : "Clique para anexar cards / imagens"}
                </span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
                className="hidden"
                onChange={handleFilesSelected}
              />
              <p className="text-[10px] text-vitti-fg-muted/45 mt-1 font-light">
                JPG, PNG, WebP ou PDF · Múltiplos arquivos permitidos
              </p>
            </div>

            {/* 11. Considerações (visual placeholder) */}
            <div>
              <label className={labelClass}>Considerações</label>
              <div className="w-full flex items-start gap-2 border border-dashed border-black/[0.1] rounded-lg px-3 py-2.5 bg-black/[0.015] text-vitti-fg-muted/40 cursor-not-allowed min-h-[52px]">
                <MessageSquare size={13} className="mt-0.5 shrink-0" />
                <span className="text-xs font-light italic">
                  Chat de considerações (em breve)
                </span>
              </div>
            </div>

            {/* 12. Status */}
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

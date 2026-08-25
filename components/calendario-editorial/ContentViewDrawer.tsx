"use client";

import { useState, useEffect } from "react";
import {
  X,
  CalendarDays,
  Loader2,
  Send,
  Paperclip,
  Eye,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CategoryTag } from "./CategoryTag";
import { StatusBadge } from "./StatusBadge";
import { ArtPreviewModal } from "./ArtPreviewModal";
import { SuggestionInlineHighlight } from "./SuggestionInlineHighlight";
import { SuggestionModal } from "./SuggestionModal";
import { useEditorialSuggestions } from "@/lib/hooks/useEditorialSuggestions";
import type { ContentRow } from "./CalendarioEditorialShell";
import { NotificationRecipientsSelect } from "./NotificationRecipientsSelect";

interface CommentItem {
  id: string;
  authorName: string;
  message: string;
  createdAt: string;
}

interface AttachmentItem {
  id: string;
  fileName: string;
  fileSize: number;
  url: string | null;
  uploadedAt: string;
}

export interface ContentViewDrawerProps {
  open: boolean;
  item: ContentRow | null;
  responsibles: { id: string; name: string }[];
  onClose: () => void;
  isAdmin?: boolean;
}

const FALLBACK_CAT = { name: "Sem categoria", color: "#94A3B8" };
const FALLBACK_ST = { name: "Sem status", color: "#94A3B8" };

function FL({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[9px] font-medium text-slate-400/80 uppercase tracking-wider mb-1">
      {children}
    </span>
  );
}

function FV({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("text-sm font-light text-vitti-fg leading-relaxed", className)}>
      {children}
    </div>
  );
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso.slice(0, 16);
  }
}

function formatCommentDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function ContentViewDrawer({
  open,
  item,
  responsibles,
  onClose,
  isAdmin = false,
}: ContentViewDrawerProps) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [commentError, setCommentError] = useState("");
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [attachmentError, setAttachmentError] = useState(false);
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);
  const [artModalOpen, setArtModalOpen] = useState(false);
  const [artModalIndex, setArtModalIndex] = useState(0);
  const [suggestionModalOpen, setSuggestionModalOpen] = useState(false);
  const [pendingField, setPendingField] = useState<"description" | "caption" | null>(null);
  const [pendingSelection, setPendingSelection] = useState<{
    start: number;
    end: number;
    text: string;
  } | null>(null);

  const { suggestions, submit: submitSuggestion } = useEditorialSuggestions(
    item?.id ?? null,
    open && !!item,
  );

  const responsiblesMap = new Map(responsibles.map((r) => [r.id, r.name]));

  useEffect(() => {
    if (!open || !item) {
      setComments([]);
      setNewComment("");
      setCommentError("");
      setAttachments([]);
      setAttachmentError(false);
      setArtModalOpen(false);
      setArtModalIndex(0);
      setSelectedProfileIds([]);
      setSuggestionModalOpen(false);
      setPendingField(null);
      setPendingSelection(null);
      return;
    }

    setSelectedProfileIds([]);
    setLoadingComments(true);
    fetch(`/api/admin/editorial/${item.id}/comments`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setComments(data.comments ?? []);
      })
      .catch(() => {})
      .finally(() => setLoadingComments(false));

    if (item.attachmentCount > 0) {
      setLoadingAttachments(true);
      setAttachmentError(false);
      fetch(`/api/admin/editorial/${item.id}/attachments`)
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            setAttachments(data.attachments ?? []);
          } else {
            setAttachmentError(true);
          }
        })
        .catch(() => setAttachmentError(true))
        .finally(() => setLoadingAttachments(false));
    } else {
      setAttachments([]);
      setAttachmentError(false);
    }
  }, [open, item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAddComment() {
    if (!item || !newComment.trim() || selectedProfileIds.length === 0) return;
    setSubmitting(true);
    setCommentError("");
    try {
      const res = await fetch(`/api/admin/editorial/${item.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: newComment.trim(),
          notificationRecipientProfileIds: selectedProfileIds,
        }),
      });
      const data = (await res.json()) as {
        success: boolean;
        comment?: CommentItem;
        error?: string;
        code?: string;
      };
      if (!res.ok || !data.success) {
        const msg = [data.error, data.code ? `(${data.code})` : null]
          .filter(Boolean)
          .join(" ");
        setCommentError(msg || "Erro ao salvar.");
        return;
      }
      if (data.comment) setComments((prev) => [...prev, data.comment!]);
      setNewComment("");
      setSelectedProfileIds([]);
    } catch {
      setCommentError("Erro de conexão.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSuggestDescription(start: number, end: number, text: string) {
    setPendingField("description");
    setPendingSelection({ start, end, text });
    setSuggestionModalOpen(true);
  }

  function handleSuggestCaption(start: number, end: number, text: string) {
    setPendingField("caption");
    setPendingSelection({ start, end, text });
    setSuggestionModalOpen(true);
  }

  async function handleSuggestionSubmit(proposedText: string | null) {
    if (!pendingField || !pendingSelection)
      return { success: false, error: "Seleção inválida." };
    return submitSuggestion({
      field: pendingField,
      original_start: pendingSelection.start,
      original_end: pendingSelection.end,
      original_text: pendingSelection.text,
      proposed_text: proposedText,
    });
  }

  const category = item?.categoryName
    ? { name: item.categoryName, color: item.categoryColor! }
    : FALLBACK_CAT;
  const status = item?.statusName
    ? { name: item.statusName, color: item.statusColor! }
    : FALLBACK_ST;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Art preview modal — z-[70] sits above the drawer (z-50) */}
      <ArtPreviewModal
        open={artModalOpen}
        attachments={attachments}
        currentIndex={artModalIndex}
        onChangeIndex={setArtModalIndex}
        onClose={() => setArtModalOpen(false)}
      />

      {/* Modal de sugestão de alteração */}
      <SuggestionModal
        open={suggestionModalOpen}
        field={pendingField ?? "description"}
        selectedText={pendingSelection?.text ?? ""}
        onClose={() => {
          setSuggestionModalOpen(false);
          setPendingField(null);
          setPendingSelection(null);
        }}
        onSubmit={handleSuggestionSubmit}
      />

      {/* Drawer */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full z-50 w-full max-w-[480px]",
          "bg-white shadow-[-20px_0_60px_rgba(0,0,0,0.1)]",
          "transition-transform duration-300 ease-out flex flex-col"
        )}
        style={{ transform: open ? "translateX(0)" : "translateX(100%)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200/60 flex items-center justify-center shrink-0">
              <CalendarDays size={12} className="text-vitti-light/60" />
            </div>
            <p className="text-sm font-light text-vitti-blue tracking-wide">
              Detalhes do conteúdo
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        {item ? (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

            {/* Categoria + Status */}
            <div className="flex items-start gap-6">
              <div>
                <FL>Categoria</FL>
                <CategoryTag name={category.name} color={category.color} />
              </div>
              <div>
                <FL>Status</FL>
                <StatusBadge name={status.name} color={status.color} />
              </div>
            </div>

            {/* Cliente + Responsável — admin only */}
            {isAdmin && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FL>Cliente</FL>
                  <FV>{item.clientName}</FV>
                </div>
                <div>
                  <FL>Responsável</FL>
                  <FV>
                    {item.responsibleId
                      ? (responsiblesMap.get(item.responsibleId) ?? "—")
                      : "—"}
                  </FV>
                </div>
              </div>
            )}

            {/* Título */}
            <div>
              <FL>Título do post</FL>
              <FV>{item.title}</FV>
            </div>

            {/* Descrição */}
            <div>
              <FL>Descrição</FL>
              <FV>
                <SuggestionInlineHighlight
                  text={item.description}
                  suggestions={suggestions}
                  field="description"
                  canSuggest={!isAdmin}
                  onSuggest={handleSuggestDescription}
                />
              </FV>
            </div>

            {/* Legenda */}
            <div>
              <FL>Legenda</FL>
              <FV>
                <SuggestionInlineHighlight
                  text={item.caption}
                  suggestions={suggestions}
                  field="caption"
                  canSuggest={!isAdmin}
                  onSuggest={handleSuggestCaption}
                />
              </FV>
            </div>

            {/* Datas */}
            <div className={isAdmin ? "grid grid-cols-2 gap-4" : undefined}>
              {isAdmin && (
                <div>
                  <FL>Data de entrega</FL>
                  <FV>{formatDate(item.deliveryAt)}</FV>
                </div>
              )}
              <div>
                <FL>Data e hora da postagem</FL>
                <FV>{formatDateTime(item.scheduledAt)}</FV>
              </div>
            </div>

            {/* Vídeo */}
            {item.videoUrl && (
              <div>
                <FL>Link do vídeo</FL>
                <FV>
                  <a
                    href={item.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-purple-500 hover:text-purple-600 transition-colors text-sm"
                  >
                    <ExternalLink size={12} />
                    Abrir vídeo
                  </a>
                </FV>
              </div>
            )}

            {/* Anexos */}
            {item.attachmentCount > 0 && (
              <div>
                <FL>Cards / artes</FL>
                {loadingAttachments ? (
                  <div className="flex items-center gap-2 text-xs text-vitti-fg-muted/50 py-1">
                    <Loader2 size={11} className="animate-spin" />
                    Carregando cards...
                  </div>
                ) : attachmentError ? (
                  <p className="text-xs font-light text-red-400/70 py-1">
                    Não foi possível carregar os cards.
                  </p>
                ) : attachments.length === 0 ? (
                  <p className="text-xs font-light text-vitti-fg-muted/40 py-1">
                    Nenhum card encontrado.
                  </p>
                ) : (
                  <div className="space-y-1.5 mt-1">
                    {attachments.map((att, idx) => (
                      <div
                        key={att.id}
                        className="flex items-center gap-2.5 p-2.5 rounded-lg border border-black/[0.07] bg-slate-50/60"
                      >
                        <Paperclip size={11} className="text-vitti-fg-muted/40 shrink-0" />
                        <span className="text-xs font-light text-vitti-fg truncate flex-1">
                          {att.fileName}
                        </span>
                        {att.url && (
                          <button
                            type="button"
                            onClick={() => {
                              setArtModalIndex(idx);
                              setArtModalOpen(true);
                            }}
                            className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md border border-black/[0.08] text-[10px] font-light text-vitti-fg-muted hover:bg-vitti-blue hover:text-white hover:border-vitti-blue transition-all"
                          >
                            <Eye size={9} />
                            Ver
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Divider */}
            <div className="border-t border-black/[0.06]" />

            {/* Considerações */}
            <div>
              <FL>Considerações</FL>
              {loadingComments ? (
                <div className="flex items-center gap-2 text-xs text-vitti-fg-muted/50 py-2">
                  <Loader2 size={11} className="animate-spin" />
                  Carregando...
                </div>
              ) : (
                <>
                  {comments.length === 0 ? (
                    <p className="text-xs font-light text-vitti-fg/40 mb-3">
                      Sem considerações ainda.
                    </p>
                  ) : (
                    <div className="space-y-2 mb-3">
                      {comments.map((c) => (
                        <div
                          key={c.id}
                          className="px-3 py-2.5 rounded-lg bg-slate-50 border border-black/[0.06]"
                        >
                          <p className="text-xs font-light text-vitti-fg leading-relaxed whitespace-pre-wrap">
                            {c.message}
                          </p>
                          <p className="text-[9px] font-light text-vitti-fg/40 mt-1">
                            {c.authorName} · {formatCommentDate(c.createdAt)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add comment */}
                  <div className="space-y-2">
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                          e.preventDefault();
                          handleAddComment();
                        }
                      }}
                      placeholder="Nova consideração... (Ctrl+Enter para enviar)"
                      rows={3}
                      className="w-full text-xs font-light text-vitti-fg border border-black/[0.1] rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-1 focus:ring-vitti-blue/30 placeholder:text-vitti-fg/25 resize-none"
                    />
                    <NotificationRecipientsSelect
                      contentId={item.id}
                      value={selectedProfileIds}
                      onChange={setSelectedProfileIds}
                    />
                    {commentError && (
                      <p className="text-[10px] font-light text-red-400">
                        {commentError}
                      </p>
                    )}
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleAddComment}
                        disabled={submitting || !newComment.trim() || selectedProfileIds.length === 0}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-vitti-blue/[0.07] border border-vitti-blue/[0.15] text-[10px] font-light text-vitti-blue hover:bg-vitti-blue hover:text-white hover:border-vitti-blue transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {submitting ? (
                          <Loader2 size={9} className="animate-spin" />
                        ) : (
                          <Send size={9} />
                        )}
                        {submitting ? "Salvando..." : "Adicionar consideração"}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-vitti-fg-muted/40 font-light">
              Nenhum item selecionado.
            </p>
          </div>
        )}
      </div>
    </>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ChevronDown,
  ChevronUp,
  Inbox,
  MessageSquare,
  Pencil,
  Loader2,
  Link2,
  ExternalLink,
  Eye,
  Paperclip,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getPlatformLabel } from "@/lib/editorial-platforms";
import { parseEditorialRichText } from "@/lib/editorial-rich-text";
import CommentField from "./CommentField";
import { CategoryTag } from "./CategoryTag";
import { StatusBadge } from "./StatusBadge";
import { ArtPreviewModal } from "./ArtPreviewModal";
import type { ModalAttachment } from "./ArtPreviewModal";
import { NotificationRecipientsSelect } from "./NotificationRecipientsSelect";
import { useEditorialSuggestions } from "@/lib/hooks/useEditorialSuggestions";
import { SuggestionInlineHighlight } from "./SuggestionInlineHighlight";
import { SuggestionModal } from "./SuggestionModal";

export interface ListaContentItem {
  id: string;
  title: string;
  description: string | null;
  descriptionRich: string | null;
  caption: string | null;
  captionRich: string | null;
  responsibleName: string | null;
  category: { name: string; color: string };
  status: { name: string; color: string };
  scheduledAt: string | null;
  deliveryAt: string | null;
  clientName: string;
  videoUrl: string | null;
  attachmentCount: number;
  commentCount: number;
  platforms: string[];
}

interface AttachmentItem {
  id: string;
  fileName: string;
  fileSize: number;
  url: string | null;
  uploadedAt: string;
}

interface CommentItem {
  id: string;
  authorName: string;
  message: string;
  createdAt: string;
}

interface ListaEditorialViewProps {
  items?: ListaContentItem[];
  isAdmin?: boolean;
  onSelectItem?: (item: ListaContentItem) => void;
}

// Grid template: Categoria | Cliente | Responsável | Título | Descrição | Legenda |
//               [Entrega — admin only] | Data postagem | Arquivo | Considerações | Status | Chevron
const GRID_ADMIN =
  "78px 72px 108px 108px minmax(130px,1fr) 108px 108px 84px 100px 96px 108px 108px 28px";
const GRID_CLIENT =
  "78px 72px minmax(130px,1fr) 108px 108px 100px 96px 108px 108px 28px";

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

function clip(text: string | null | undefined, len = 52): string {
  if (!text) return "—";
  return text.length > len ? text.slice(0, len) + "…" : text;
}

function FL({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[9px] font-medium text-vitti-fg-muted/50 uppercase tracking-wider mb-1">
      {children}
    </span>
  );
}
function FV({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-light text-vitti-fg leading-relaxed">
      {children}
    </div>
  );
}

const HEADERS_ADMIN = [
  "Categoria",
  "Plataforma",
  "Cliente",
  "Responsável",
  "Título",
  "Descrição",
  "Legenda",
  "Entrega",
  "Data postagem",
  "Arquivo",
  "Considerações",
  "Status",
  "",
];

const HEADERS_CLIENT = [
  "Categoria",
  "Plataforma",
  "Título",
  "Descrição",
  "Legenda",
  "Data postagem",
  "Arquivo",
  "Considerações",
  "Status",
  "",
];

export function ListaEditorialView({
  items = [],
  isAdmin = false,
  onSelectItem,
}: ListaEditorialViewProps) {
  const GRID = isAdmin ? GRID_ADMIN : GRID_CLIENT;
  const HEADERS = isAdmin ? HEADERS_ADMIN : HEADERS_CLIENT;

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [attachmentsCache, setAttachmentsCache] = useState<
    Record<string, AttachmentItem[]>
  >({});
  const [loadingAttachments, setLoadingAttachments] = useState<Set<string>>(
    new Set()
  );
  const [commentsCache, setCommentsCache] = useState<Record<string, CommentItem[]>>({});
  const [loadingComments, setLoadingComments] = useState<Set<string>>(new Set());
  const [newCommentText, setNewCommentText] = useState<Record<string, string>>({});
  const [submittingComment, setSubmittingComment] = useState<Set<string>>(new Set());
  const [commentErrors, setCommentErrors] = useState<Record<string, string>>({});
  const [localCommentCounts, setLocalCommentCounts] = useState<Record<string, number>>({});
  const [selectedProfileIds, setSelectedProfileIds] = useState<Record<string, string[]>>({});

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalAttachments, setModalAttachments] = useState<ModalAttachment[]>([]);
  const [modalIndex, setModalIndex] = useState(0);

  // Suggestion state — fetches only for the currently expanded item, only for client users
  const { suggestions, submit: submitSuggestion } = useEditorialSuggestions(
    expandedId,
    !isAdmin && expandedId !== null,
  );
  const [suggestionModalOpen, setSuggestionModalOpen] = useState(false);
  const [pendingField, setPendingField] = useState<"description" | "caption" | null>(null);
  const [pendingSugSel, setPendingSugSel] = useState<{
    start: number;
    end: number;
    text: string;
  } | null>(null);

  function handleSuggestDesc(s: number, e: number, t: string) {
    setPendingField("description");
    setPendingSugSel({ start: s, end: e, text: t });
    setSuggestionModalOpen(true);
  }
  function handleSuggestCap(s: number, e: number, t: string) {
    setPendingField("caption");
    setPendingSugSel({ start: s, end: e, text: t });
    setSuggestionModalOpen(true);
  }
  async function handleSuggestionSubmit(
    proposed: string | null,
  ): Promise<{ success: boolean; error?: string; conflict?: boolean }> {
    if (!pendingField || !pendingSugSel) return { success: false, error: "Estado inválido." };
    return submitSuggestion({
      field: pendingField,
      original_start: pendingSugSel.start,
      original_end: pendingSugSel.end,
      original_text: pendingSugSel.text,
      proposed_text: proposed,
    });
  }

  // Lazy-load attachments when an expanded row has cards
  useEffect(() => {
    if (!expandedId) return;
    const item = items.find((i) => i.id === expandedId);
    if (!item || item.attachmentCount === 0) return;
    if (attachmentsCache[expandedId] !== undefined) return;

    setLoadingAttachments((prev) => new Set(prev).add(expandedId));

    fetch(`/api/admin/editorial/${expandedId}/attachments`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setAttachmentsCache((prev) => ({
            ...prev,
            [expandedId]: data.attachments,
          }));
        }
      })
      .catch(() => {})
      .finally(() => {
        setLoadingAttachments((prev) => {
          const next = new Set(prev);
          next.delete(expandedId!);
          return next;
        });
      });
  }, [expandedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lazy-load comments when a row is expanded
  useEffect(() => {
    if (!expandedId) return;
    if (commentsCache[expandedId] !== undefined) return; // already cached

    setLoadingComments((prev) => new Set(prev).add(expandedId));

    fetch(`/api/admin/editorial/${expandedId}/comments`)
      .then((r) => r.json())
      .then((data) => {
        setCommentsCache((prev) => ({
          ...prev,
          [expandedId]: data.success ? (data.comments ?? []) : [],
        }));
      })
      .catch(() => {
        setCommentsCache((prev) => ({ ...prev, [expandedId]: [] }));
      })
      .finally(() => {
        setLoadingComments((prev) => {
          const next = new Set(prev);
          next.delete(expandedId!);
          return next;
        });
      });
  }, [expandedId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAddComment(itemId: string) {
    const text = (newCommentText[itemId] ?? "").trim();
    const ids = selectedProfileIds[itemId] ?? [];
    if (!text || !ids.length) return;

    setSubmittingComment((prev) => new Set(prev).add(itemId));
    setCommentErrors((prev) => ({ ...prev, [itemId]: "" }));

    try {
      const res = await fetch(`/api/admin/editorial/${itemId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, notificationRecipientProfileIds: ids }),
      });
      const data = await res.json() as {
        success: boolean;
        comment?: CommentItem;
        error?: string;
        code?: string;
      };

      if (!res.ok || !data.success) {
        const msg = [data.error, data.code ? `(${data.code})` : null]
          .filter(Boolean)
          .join(" ");
        setCommentErrors((prev) => ({ ...prev, [itemId]: msg || "Erro ao salvar." }));
        return;
      }

      if (data.comment) {
        setCommentsCache((prev) => ({
          ...prev,
          [itemId]: [...(prev[itemId] ?? []), data.comment!],
        }));
      }

      // Update local count so the collapsed row reflects the addition immediately
      setLocalCommentCounts((prev) => {
        const base = prev[itemId] ?? items.find((i) => i.id === itemId)?.commentCount ?? 0;
        return { ...prev, [itemId]: base + 1 };
      });

      setNewCommentText((prev) => ({ ...prev, [itemId]: "" }));
      setSelectedProfileIds((prev) => ({ ...prev, [itemId]: [] }));
    } catch {
      setCommentErrors((prev) => ({ ...prev, [itemId]: "Erro de conexão." }));
    } finally {
      setSubmittingComment((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  }

  // Fetch attachments for modal, using cache when available
  const openArtModal = useCallback(
    async (itemId: string, initialIndex = 0) => {
      const cached = attachmentsCache[itemId];
      if (cached) {
        setModalAttachments(cached);
        setModalIndex(initialIndex);
        setModalOpen(true);
        return;
      }

      // Need to fetch first — mark as loading in the set so the button shows spinner
      setLoadingAttachments((prev) => new Set(prev).add(itemId));

      try {
        const r = await fetch(`/api/admin/editorial/${itemId}/attachments`);
        const data = await r.json();
        if (data.success) {
          const atts: AttachmentItem[] = data.attachments ?? [];
          setAttachmentsCache((prev) => ({ ...prev, [itemId]: atts }));
          setModalAttachments(atts);
          setModalIndex(initialIndex);
          setModalOpen(true);
        }
      } catch { /* ignore */ } finally {
        setLoadingAttachments((prev) => {
          const next = new Set(prev);
          next.delete(itemId);
          return next;
        });
      }
    },
    [attachmentsCache]
  );

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-white bg-white/60 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] p-14 flex flex-col items-center gap-3 text-center">
        <Inbox size={26} className="text-vitti-blue/15" />
        <p className="text-sm font-light text-vitti-blue/50">
          Nenhum conteúdo cadastrado ainda.
        </p>
        <p className="text-xs text-vitti-blue/35 font-light max-w-[260px] leading-relaxed">
          Crie o primeiro conteúdo editorial para que ele apareça aqui.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-2xl border border-white bg-white/60 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[1300px]">

            {/* ── Header ─────────────────────────────────────────────── */}
            <div
              className="grid items-center px-4 py-2.5 border-b border-black/[0.06] bg-black/[0.02]"
              style={{ gridTemplateColumns: GRID }}
            >
              {HEADERS.map((h, i) => (
                <span
                  key={i}
                  className="text-[9px] font-medium text-vitti-fg-muted/50 tracking-wider uppercase pr-2 truncate"
                >
                  {h}
                </span>
              ))}
            </div>

            {/* ── Rows ───────────────────────────────────────────────── */}
            <div className="divide-y divide-black/[0.04]">
              {items.map((item) => {
                const isExpanded = expandedId === item.id;
                const cachedAttachments = attachmentsCache[item.id];
                const isLoadingThis = loadingAttachments.has(item.id);
                const hasCards = item.attachmentCount > 0;
                const hasVideo = !!item.videoUrl;

                return (
                  <div key={item.id}>
                    {/* Collapsed row */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        setExpandedId(isExpanded ? null : item.id)
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ")
                          setExpandedId(isExpanded ? null : item.id);
                      }}
                      className={cn(
                        "grid items-center w-full text-left px-4 py-3 cursor-pointer select-none transition-colors",
                        isExpanded
                          ? "bg-black/[0.012]"
                          : "hover:bg-black/[0.018]"
                      )}
                      style={{ gridTemplateColumns: GRID }}
                    >
                      {/* 1. Categoria */}
                      <div>
                        <CategoryTag
                          name={item.category.name}
                          color={item.category.color}
                          small
                        />
                      </div>

                      {/* 2. Plataforma */}
                      <div className="pr-1">
                        {item.platforms.length === 0 ? (
                          <span className="text-[10px] font-light text-vitti-fg/40">—</span>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] font-light text-vitti-fg truncate">
                              {getPlatformLabel(item.platforms[0])}
                            </span>
                            {item.platforms.length > 1 && (
                              <span className="text-[9px] font-light text-vitti-fg-muted/50">
                                +{item.platforms.length - 1}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* 2. Cliente — admin only */}
                      {isAdmin && (
                        <span className="text-[10px] font-light text-vitti-fg truncate pr-2">
                          {item.clientName}
                        </span>
                      )}

                      {/* 3. Responsável — admin only */}
                      {isAdmin && (
                        <span className="text-[10px] font-light text-vitti-fg truncate pr-2">
                          {item.responsibleName ?? "—"}
                        </span>
                      )}

                      {/* 4. Título */}
                      <span className="text-[10px] font-light text-vitti-fg truncate pr-3">
                        {item.title}
                      </span>

                      {/* 5. Descrição */}
                      <span className="text-[10px] font-light text-vitti-fg truncate pr-2">
                        {clip(item.description)}
                      </span>

                      {/* 6. Legenda */}
                      <span className="text-[10px] font-light text-vitti-fg truncate pr-2">
                        {clip(item.caption)}
                      </span>

                      {/* 7. Data de entrega — admin only */}
                      {isAdmin && (
                        <span className="text-[10px] font-light text-vitti-fg pr-2">
                          {formatDate(item.deliveryAt)}
                        </span>
                      )}

                      {/* 8. Data postagem */}
                      <span className="text-[10px] font-light text-vitti-fg pr-2">
                        {formatDateTime(item.scheduledAt)}
                      </span>

                      {/* 9. Arquivo */}
                      <div className="pr-1 flex flex-col gap-0.5 items-start">
                        {/* Video badge */}
                        {hasVideo && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-50 border border-purple-200/60">
                            <Link2 size={8} className="text-purple-400" />
                            <span className="text-[8px] font-medium text-purple-500">
                              Vídeo
                            </span>
                          </span>
                        )}
                        {/* Cards — "Ver arte" button */}
                        {hasCards ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openArtModal(item.id);
                            }}
                            disabled={isLoadingThis}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-vitti-blue/[0.07] border border-vitti-blue/[0.15] text-vitti-blue/70 hover:bg-vitti-blue hover:text-white hover:border-vitti-blue transition-all disabled:opacity-50"
                          >
                            {isLoadingThis ? (
                              <Loader2 size={8} className="animate-spin" />
                            ) : (
                              <Eye size={8} />
                            )}
                            <span className="text-[8px] font-medium">
                              {isLoadingThis
                                ? "..."
                                : `${item.attachmentCount === 1 ? "1 card" : `${item.attachmentCount} cards`}`}
                            </span>
                          </button>
                        ) : !hasVideo ? (
                          <span className="text-[10px] font-light text-vitti-fg/40">
                            Sem arquivo
                          </span>
                        ) : null}
                      </div>

                      {/* 10. Considerações */}
                      {(() => {
                        const count = localCommentCounts[item.id] ?? item.commentCount;
                        return count > 0 ? (
                          <span className="text-[10px] font-light text-vitti-fg pr-2 truncate">
                            {count === 1 ? "1 consideração" : `${count} considerações`}
                          </span>
                        ) : (
                          <span className="text-[10px] font-light text-vitti-fg/40 pr-2">
                            Sem considerações
                          </span>
                        );
                      })()}

                      {/* 11. Status */}
                      <div>
                        <StatusBadge
                          name={item.status.name}
                          color={item.status.color}
                          small
                        />
                      </div>

                      {/* Chevron */}
                      <div className="flex items-center justify-center">
                        {isExpanded ? (
                          <ChevronUp size={12} className="text-vitti-fg-muted/40" />
                        ) : (
                          <ChevronDown size={12} className="text-vitti-fg-muted/25" />
                        )}
                      </div>
                    </div>

                    {/* ── Expanded detail panel ─────────────────────── */}
                    {isExpanded && (
                      <div className="border-t border-black/[0.05] bg-[#f9f9fb] px-6 py-5">
                        <div className="grid grid-cols-3 gap-x-6 gap-y-4">

                          {/* 1. Categoria */}
                          <div>
                            <FL>Categoria</FL>
                            <FV>
                              <CategoryTag
                                name={item.category.name}
                                color={item.category.color}
                              />
                            </FV>
                          </div>

                          {/* Plataformas */}
                          {item.platforms.length > 0 && (
                            <div>
                              <FL>Plataformas</FL>
                              <FV>
                                <div className="flex flex-wrap gap-1.5">
                                  {item.platforms.map((p) => (
                                    <span
                                      key={p}
                                      className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-light border border-black/[0.1] text-vitti-fg-muted/70 bg-black/[0.02]"
                                    >
                                      {getPlatformLabel(p)}
                                    </span>
                                  ))}
                                </div>
                              </FV>
                            </div>
                          )}

                          {/* 2. Cliente — admin only */}
                          {isAdmin && (
                            <div>
                              <FL>Cliente</FL>
                              <FV>{item.clientName}</FV>
                            </div>
                          )}

                          {/* 3. Responsável — admin only */}
                          {isAdmin && (
                            <div>
                              <FL>Responsável</FL>
                              <FV>{item.responsibleName ?? "—"}</FV>
                            </div>
                          )}

                          {/* 4. Título */}
                          <div className="col-span-3">
                            <FL>Título do post</FL>
                            <FV>{item.title}</FV>
                          </div>

                          {/* 5. Descrição */}
                          <div className="col-span-3">
                            <FL>Descrição</FL>
                            <FV>
                              {isAdmin ? (
                                (item.descriptionRich ?? item.description) ? (
                                  <span className="whitespace-pre-wrap">
                                    {parseEditorialRichText(item.descriptionRich ?? item.description ?? "")}
                                  </span>
                                ) : (
                                  <span className="text-vitti-fg-muted/40 italic">
                                    Sem descrição
                                  </span>
                                )
                              ) : (
                                <SuggestionInlineHighlight
                                  text={item.description}
                                  suggestions={suggestions}
                                  field="description"
                                  canSuggest
                                  onSuggest={handleSuggestDesc}
                                  richText={item.descriptionRich}
                                />
                              )}
                            </FV>
                          </div>

                          {/* 6. Legenda */}
                          <div className="col-span-3">
                            <FL>Legenda</FL>
                            <FV>
                              {isAdmin ? (
                                (item.captionRich ?? item.caption) ? (
                                  <span className="whitespace-pre-wrap">
                                    {parseEditorialRichText(item.captionRich ?? item.caption ?? "")}
                                  </span>
                                ) : (
                                  <span className="text-vitti-fg-muted/40 italic">
                                    Sem legenda
                                  </span>
                                )
                              ) : (
                                <SuggestionInlineHighlight
                                  text={item.caption}
                                  suggestions={suggestions}
                                  field="caption"
                                  canSuggest
                                  onSuggest={handleSuggestCap}
                                  richText={item.captionRich}
                                />
                              )}
                            </FV>
                          </div>

                          {/* 7. Data de entrega — admin only */}
                          {isAdmin && (
                            <div>
                              <FL>Data de entrega</FL>
                              <FV>{formatDate(item.deliveryAt)}</FV>
                            </div>
                          )}

                          {/* 8. Data e hora da postagem */}
                          <div>
                            <FL>Data e hora da postagem</FL>
                            <FV>{formatDateTime(item.scheduledAt)}</FV>
                          </div>

                          {/* 9. Link do vídeo (only if exists) */}
                          {hasVideo ? (
                            <div>
                              <FL>Link do vídeo</FL>
                              <FV>
                                <a
                                  href={item.videoUrl!}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1.5 text-purple-500 hover:text-purple-600 transition-colors"
                                >
                                  <ExternalLink size={11} />
                                  <span>Abrir vídeo</span>
                                </a>
                              </FV>
                            </div>
                          ) : (
                            <div /> /* keep grid alignment */
                          )}

                          {/* 10. Cards / artes — compact row */}
                          {hasCards && (
                            <div className="col-span-3">
                              <FL>Cards / artes</FL>
                              <FV>
                                <div className="flex items-center gap-3 mt-0.5">
                                  {isLoadingThis ? (
                                    <span className="inline-flex items-center gap-1.5 text-vitti-fg-muted/40">
                                      <Loader2 size={11} className="animate-spin" />
                                      <span className="text-[11px] italic">Carregando...</span>
                                    </span>
                                  ) : (
                                    <>
                                      <span className="inline-flex items-center gap-1.5 text-[11px] font-light text-vitti-fg-muted/60">
                                        <Paperclip size={11} className="text-vitti-fg-muted/40" />
                                        {item.attachmentCount === 1
                                          ? "1 card anexado"
                                          : `${item.attachmentCount} cards anexados`}
                                      </span>
                                      {(cachedAttachments || !isLoadingThis) && (
                                        <button
                                          type="button"
                                          onClick={() => openArtModal(item.id)}
                                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-black/[0.1] text-[11px] font-light text-vitti-fg-muted hover:bg-vitti-blue hover:text-white hover:border-vitti-blue transition-all"
                                        >
                                          <Eye size={11} />
                                          Ver arte
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              </FV>
                            </div>
                          )}

                          {/* 11. Considerações */}
                          <div className="col-span-2">
                            <FL>Considerações</FL>
                            {loadingComments.has(item.id) ? (
                              <div className="flex items-center gap-1.5 py-1">
                                <Loader2 size={10} className="animate-spin text-vitti-fg/30" />
                                <span className="text-[10px] font-light text-vitti-fg/40">Carregando...</span>
                              </div>
                            ) : (
                              <>
                                {(commentsCache[item.id] ?? []).length === 0 ? (
                                  <p className="text-[11px] font-light text-vitti-fg/40 mb-2">
                                    Sem considerações
                                  </p>
                                ) : (
                                  <div className="space-y-1.5 mb-2">
                                    {(commentsCache[item.id] ?? []).map((c) => (
                                      <div
                                        key={c.id}
                                        className="px-2.5 py-2 rounded-lg bg-white border border-black/[0.06]"
                                      >
                                        <div className="text-[11px] font-light text-vitti-fg leading-relaxed">
                                          {parseEditorialRichText(c.message)}
                                        </div>
                                        <p className="text-[9px] font-light text-vitti-fg/40 mt-1">
                                          {c.authorName} · {formatCommentDate(c.createdAt)}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Nova consideração */}
                                <div
                                  className="space-y-1.5"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <CommentField
                                    value={newCommentText[item.id] ?? ""}
                                    onChange={(v) =>
                                      setNewCommentText((prev) => ({
                                        ...prev,
                                        [item.id]: v,
                                      }))
                                    }
                                    onSubmit={() => handleAddComment(item.id)}
                                    disabled={submittingComment.has(item.id)}
                                    placeholder="Nova consideração... (Ctrl+Enter para enviar)"
                                    rows={2}
                                  />
                                  <NotificationRecipientsSelect
                                    contentId={item.id}
                                    value={selectedProfileIds[item.id] ?? []}
                                    onChange={(ids) =>
                                      setSelectedProfileIds((prev) => ({
                                        ...prev,
                                        [item.id]: ids,
                                      }))
                                    }
                                  />
                                  {commentErrors[item.id] && (
                                    <p className="text-[10px] font-light text-red-400">
                                      {commentErrors[item.id]}
                                    </p>
                                  )}
                                  <div className="flex justify-end">
                                    <button
                                      type="button"
                                      onClick={() => handleAddComment(item.id)}
                                      disabled={
                                        submittingComment.has(item.id) ||
                                        !(newCommentText[item.id] ?? "").trim() ||
                                        !(selectedProfileIds[item.id]?.length)
                                      }
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-vitti-blue/[0.07] border border-vitti-blue/[0.15] text-[10px] font-light text-vitti-blue hover:bg-vitti-blue hover:text-white hover:border-vitti-blue transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                      {submittingComment.has(item.id) ? (
                                        <Loader2 size={9} className="animate-spin" />
                                      ) : (
                                        <Send size={9} />
                                      )}
                                      {submittingComment.has(item.id) ? "Salvando..." : "Adicionar"}
                                    </button>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>

                          {/* 12. Status */}
                          <div>
                            <FL>Status</FL>
                            <FV>
                              <StatusBadge
                                name={item.status.name}
                                color={item.status.color}
                              />
                            </FV>
                          </div>
                        </div>

                        {/* Editar — apenas admin */}
                        {isAdmin && (
                          <div className="flex justify-end mt-4 pt-4 border-t border-black/[0.05]">
                            <button
                              onClick={() => onSelectItem?.(item)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-black/[0.1] text-[11px] font-light text-vitti-fg-muted hover:bg-vitti-blue hover:text-white hover:border-vitti-blue transition-all"
                            >
                              <Pencil size={11} />
                              Editar conteúdo
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Art preview modal — rendered outside the list for correct stacking */}
      <ArtPreviewModal
        open={modalOpen}
        attachments={modalAttachments}
        currentIndex={modalIndex}
        onChangeIndex={setModalIndex}
        onClose={() => setModalOpen(false)}
      />

      {/* Suggestion modal — single instance for all rows */}
      <SuggestionModal
        open={suggestionModalOpen}
        field={pendingField ?? "description"}
        selectedText={pendingSugSel?.text ?? ""}
        onClose={() => {
          setSuggestionModalOpen(false);
          setPendingField(null);
          setPendingSugSel(null);
        }}
        onSubmit={handleSuggestionSubmit}
      />
    </>
  );
}

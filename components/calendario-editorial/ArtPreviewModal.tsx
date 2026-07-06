"use client";

import { useEffect, useCallback, useState } from "react";
import {
  X,
  Download,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
} from "lucide-react";

export interface ModalAttachment {
  id: string;
  fileName: string;
  fileSize: number;
  url: string | null;
}

interface ArtPreviewModalProps {
  open: boolean;
  attachments: ModalAttachment[];
  currentIndex: number;
  onChangeIndex: (index: number) => void;
  onClose: () => void;
}

function isImageFile(fileName: string): boolean {
  return /\.(jpg|jpeg|png|webp|gif|avif|svg)$/i.test(fileName);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ArtPreviewModal({
  open,
  attachments,
  currentIndex,
  onChangeIndex,
  onClose,
}: ArtPreviewModalProps) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const total = attachments.length;
  const current = attachments[currentIndex] ?? null;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < total - 1;
  const isImage = current ? isImageFile(current.fileName) : false;
  const showDots = total > 1 && total <= 12;

  async function handleDownload(att: ModalAttachment) {
    if (!att.url) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const res = await fetch(att.url);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = att.fileName || "arquivo";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch {
      setDownloadError("Não foi possível baixar o arquivo. Tente novamente.");
    } finally {
      setDownloading(false);
    }
  }

  const goPrev = useCallback(() => {
    if (hasPrev) onChangeIndex(currentIndex - 1);
  }, [hasPrev, currentIndex, onChangeIndex]);

  const goNext = useCallback(() => {
    if (hasNext) onChangeIndex(currentIndex + 1);
  }, [hasNext, currentIndex, onChangeIndex]);

  // Clear download error when navigating or closing
  useEffect(() => {
    setDownloadError(null);
  }, [currentIndex, open]);

  // Keyboard navigation + scroll lock
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    }
    window.addEventListener("keydown", handleKey);

    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [open, goPrev, goNext, onClose]);

  if (!open || !current) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col bg-white rounded-2xl shadow-[0_32px_64px_rgba(0,0,0,0.35)] overflow-hidden"
        style={{
          width: "min(92vw, 1000px)",
          maxHeight: "90vh",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-black/[0.06] bg-white shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="text-xs font-light text-vitti-fg truncate"
              style={{ maxWidth: "420px" }}
            >
              {current.fileName}
            </span>
            <span className="text-[10px] text-vitti-fg-muted/45 shrink-0">
              {formatBytes(current.fileSize)}
            </span>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 ml-4">
            {total > 1 && (
              <span className="text-[11px] font-light text-vitti-fg-muted/55">
                {currentIndex + 1} de {total}
              </span>
            )}
            {current.url && (
              <button
                type="button"
                onClick={() => handleDownload(current)}
                disabled={downloading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-black/[0.1] text-[11px] font-light text-vitti-fg-muted hover:bg-vitti-blue hover:text-white hover:border-vitti-blue transition-all disabled:opacity-50"
              >
                {downloading ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <Download size={11} />
                )}
                {downloading ? "Baixando..." : "Download"}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-vitti-fg-muted/40 hover:bg-black/[0.05] hover:text-vitti-fg transition-all"
              aria-label="Fechar"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Download error ─────────────────────────────────────────── */}
        {downloadError && (
          <div className="px-5 py-2 bg-red-50 border-b border-red-100 shrink-0">
            <p className="text-[11px] text-red-500 font-light">{downloadError}</p>
          </div>
        )}

        {/* ── Image area ─────────────────────────────────────────────── */}
        <div
          className="relative flex-1 flex items-center justify-center bg-[#111111] min-h-0"
          style={{ minHeight: "300px" }}
        >
          {isImage && current.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={current.id}
              src={current.url}
              alt={current.fileName}
              className="max-w-full object-contain select-none"
              style={{ maxHeight: "calc(90vh - 56px - 48px)" }}
              draggable={false}
            />
          ) : (
            /* PDF or unsupported type — show download placeholder */
            <div className="flex flex-col items-center gap-4 py-20 px-8 text-center">
              <FileText size={52} className="text-white/20" />
              <p className="text-sm font-light text-white/60">
                {current.fileName}
              </p>
              <p className="text-xs text-white/35 font-light">
                Visualização não disponível para este tipo de arquivo.
              </p>
              {current.url && (
                <button
                  type="button"
                  onClick={() => handleDownload(current)}
                  disabled={downloading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-vitti-blue text-white text-xs font-light hover:bg-vitti-blue/90 transition-all disabled:opacity-50"
                >
                  {downloading ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Download size={13} />
                  )}
                  {downloading ? "Baixando..." : "Baixar arquivo"}
                </button>
              )}
            </div>
          )}

          {/* Prev arrow */}
          {hasPrev && (
            <button
              onClick={goPrev}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/10 backdrop-blur-sm text-white/80 hover:bg-white/20 hover:text-white transition-all"
              aria-label="Card anterior"
            >
              <ChevronLeft size={22} />
            </button>
          )}

          {/* Next arrow */}
          {hasNext && (
            <button
              onClick={goNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/10 backdrop-blur-sm text-white/80 hover:bg-white/20 hover:text-white transition-all"
              aria-label="Próximo card"
            >
              <ChevronRight size={22} />
            </button>
          )}
        </div>

        {/* ── Dots footer ────────────────────────────────────────────── */}
        {showDots && (
          <div className="flex items-center justify-center gap-2 py-3 bg-[#111111] shrink-0">
            {attachments.map((_, i) => (
              <button
                key={i}
                onClick={() => onChangeIndex(i)}
                aria-label={`Card ${i + 1}`}
                className={`rounded-full transition-all duration-200 ${
                  i === currentIndex
                    ? "bg-white w-4 h-1.5"
                    : "bg-white/30 w-1.5 h-1.5 hover:bg-white/55"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

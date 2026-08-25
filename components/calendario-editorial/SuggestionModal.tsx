"use client";

import { useState, useEffect } from "react";
import { X, Loader2, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/lib/hooks/useEditorialSuggestions";

interface Props {
  open: boolean;
  field: "description" | "caption";
  selectedText: string;
  onClose: () => void;
  onSubmit: (proposedText: string | null) => Promise<ActionResult>;
}

const MAX_CHARS = 500;

export function SuggestionModal({
  open,
  field,
  selectedText,
  onClose,
  onSubmit,
}: Props) {
  const [proposedText, setProposedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setProposedText("");
      setError(null);
    }
  }, [open]);

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    const result = await onSubmit(proposedText.trim() || null);
    if (!result.success) {
      setError(result.error ?? "Erro ao enviar sugestão.");
      setLoading(false);
    } else {
      setLoading(false);
      onClose();
    }
  }

  if (!open) return null;

  const fieldLabel = field === "description" ? "Descrição" : "Legenda";
  const remaining = MAX_CHARS - proposedText.length;

  return (
    <>
      <div
        className="fixed inset-0 z-[65] bg-black/20 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-[66] flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.18)] w-full max-w-md pointer-events-auto">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06]">
            <div>
              <p className="text-sm font-light text-vitti-blue tracking-wide">
                Sugerir alteração
              </p>
              <p className="text-[10px] text-vitti-fg-muted/50 font-light mt-0.5">
                {fieldLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-vitti-fg-muted/40 hover:bg-black/[0.04] transition-all"
            >
              <X size={15} />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-4 space-y-4">

            {/* Trecho selecionado */}
            <div>
              <p className="text-[10px] font-medium text-vitti-fg-muted/65 uppercase tracking-wide mb-1.5">
                Trecho selecionado
              </p>
              <div className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-100">
                <p className="text-xs font-light text-red-600 line-through whitespace-pre-wrap leading-relaxed">
                  {selectedText}
                </p>
              </div>
            </div>

            {/* Texto proposto */}
            <div>
              <p className="text-[10px] font-medium text-vitti-fg-muted/65 uppercase tracking-wide mb-1.5">
                Substituir por
              </p>
              <textarea
                value={proposedText}
                onChange={(e) =>
                  setProposedText(e.target.value.slice(0, MAX_CHARS))
                }
                maxLength={MAX_CHARS}
                rows={3}
                placeholder="Deixe em branco caso queira apenas remover este trecho."
                className={cn(
                  "w-full text-xs font-light text-vitti-fg border border-black/[0.1] rounded-lg px-3 py-2",
                  "bg-white focus:outline-none focus:ring-1 focus:ring-vitti-blue/30",
                  "placeholder:text-vitti-fg-muted/35 resize-none",
                )}
              />
              <div className="flex justify-between items-center mt-1">
                <p className="text-[10px] text-vitti-fg-muted/40 font-light">
                  Opcional — deixe em branco para remover o trecho.
                </p>
                <p
                  className={cn(
                    "text-[10px] font-light shrink-0",
                    remaining < 50 ? "text-red-400" : "text-vitti-fg-muted/30",
                  )}
                >
                  {remaining}
                </p>
              </div>
            </div>

            {error && (
              <p className="text-[11px] text-red-500 font-light bg-red-50 px-3 py-2 rounded-lg border border-red-100">
                {error}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-black/[0.06]">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-3.5 py-2 rounded-lg border border-black/[0.1] text-[11px] font-light text-vitti-fg-muted hover:bg-black/[0.02] transition-all disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-vitti-blue text-white text-[11px] font-light hover:bg-vitti-blue/90 transition-all disabled:opacity-50"
            >
              {loading ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <Send size={11} />
              )}
              {loading ? "Enviando..." : "Enviar sugestão"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

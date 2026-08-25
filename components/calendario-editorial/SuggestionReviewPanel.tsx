"use client";

import { useState } from "react";
import { ChevronDown, Check, X, AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SuggestionRow, ActionResult } from "@/lib/hooks/useEditorialSuggestions";

interface PanelProps {
  suggestions: SuggestionRow[];
  loading: boolean;
  onAccept: (id: string) => Promise<ActionResult>;
  onReject: (id: string, note?: string) => Promise<ActionResult>;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

interface ItemProps {
  sug: SuggestionRow;
  onAccept: PanelProps["onAccept"];
  onReject: PanelProps["onReject"];
}

function SuggestionItem({ sug, onAccept, onReject }: ItemProps) {
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const isConflict = sug.status === "conflict";
  const fieldLabel = sug.field === "description" ? "Descrição" : "Legenda";

  async function handleAccept() {
    setActionLoading(true);
    setLocalError(null);
    const result = await onAccept(sug.id);
    if (!result.success) {
      setLocalError(result.error ?? "Erro ao aceitar.");
    }
    setActionLoading(false);
  }

  async function handleReject() {
    setActionLoading(true);
    setLocalError(null);
    const result = await onReject(sug.id, rejectNote.trim() || undefined);
    if (!result.success) {
      setLocalError(result.error ?? "Erro ao rejeitar.");
    } else {
      setRejectMode(false);
      setRejectNote("");
    }
    setActionLoading(false);
  }

  return (
    <div
      className={cn(
        "px-3 py-3 rounded-xl border",
        isConflict
          ? "border-amber-200 bg-amber-50/60"
          : "border-black/[0.07] bg-black/[0.01]",
      )}
    >
      {/* Cabeçalho */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        {isConflict && (
          <AlertTriangle size={11} className="text-amber-500 shrink-0" />
        )}
        <span className="text-[10px] font-medium text-vitti-fg/70 truncate">
          {sug.authorName}
        </span>
        <span className="text-[9px] text-vitti-fg-muted/40">·</span>
        <span className="text-[9px] text-vitti-fg-muted/50 shrink-0">{fieldLabel}</span>
        <span className="text-[9px] text-vitti-fg-muted/40">·</span>
        <span className="text-[9px] text-vitti-fg-muted/40 shrink-0">
          {formatDate(sug.createdAt)}
        </span>
      </div>

      {isConflict && (
        <p className="text-[10px] text-amber-600 font-light mb-2 leading-relaxed">
          Texto alterado após esta sugestão — requer revisão manual.
        </p>
      )}

      {/* Trecho original */}
      <div className="mb-1.5">
        <p className="text-[9px] font-medium text-vitti-fg-muted/50 uppercase tracking-wide mb-1">
          Trecho atual
        </p>
        <p className="text-xs font-light text-red-500 line-through leading-relaxed whitespace-pre-wrap break-words">
          {sug.original_text}
        </p>
      </div>

      {/* Sugestão */}
      <div className="mb-3">
        <p className="text-[9px] font-medium text-vitti-fg-muted/50 uppercase tracking-wide mb-1">
          Sugestão
        </p>
        {sug.proposed_text !== null ? (
          <p className="text-xs font-light text-vitti-fg leading-relaxed whitespace-pre-wrap break-words">
            {sug.proposed_text}
          </p>
        ) : (
          <p className="text-[11px] font-light text-vitti-fg-muted/60 italic">
            Remover trecho
          </p>
        )}
      </div>

      {/* Campo de nota para rejeição */}
      {rejectMode && (
        <div className="mb-3">
          <textarea
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            placeholder="Observação (opcional)..."
            rows={2}
            className="w-full text-xs font-light text-vitti-fg border border-black/[0.1] rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-red-200 placeholder:text-vitti-fg-muted/35 resize-none"
          />
        </div>
      )}

      {localError && (
        <p className="text-[10px] text-red-500 font-light mb-2">{localError}</p>
      )}

      {/* Ações */}
      <div className="flex items-center gap-2">
        {!rejectMode ? (
          <>
            {!isConflict && (
              <button
                type="button"
                onClick={handleAccept}
                disabled={actionLoading}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/[0.08] border border-emerald-500/20 text-[10px] font-light text-emerald-700 hover:bg-emerald-500/[0.15] transition-colors disabled:opacity-40"
              >
                {actionLoading ? (
                  <Loader2 size={9} className="animate-spin" />
                ) : (
                  <Check size={9} />
                )}
                Aceitar
              </button>
            )}
            <button
              type="button"
              onClick={() => setRejectMode(true)}
              disabled={actionLoading}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 border border-red-100 text-[10px] font-light text-red-500 hover:bg-red-100 transition-colors disabled:opacity-40"
            >
              <X size={9} />
              {isConflict ? "Descartar" : "Rejeitar"}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={handleReject}
              disabled={actionLoading}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500 text-white text-[10px] font-light hover:bg-red-600 transition-colors disabled:opacity-40"
            >
              {actionLoading ? (
                <Loader2 size={9} className="animate-spin" />
              ) : (
                <X size={9} />
              )}
              Confirmar rejeição
            </button>
            <button
              type="button"
              onClick={() => {
                setRejectMode(false);
                setRejectNote("");
              }}
              disabled={actionLoading}
              className="px-2.5 py-1.5 rounded-lg border border-black/[0.1] text-[10px] font-light text-vitti-fg-muted hover:bg-black/[0.02] transition-all disabled:opacity-40"
            >
              Voltar
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function SuggestionReviewPanel({
  suggestions,
  loading,
  onAccept,
  onReject,
}: PanelProps) {
  const [expanded, setExpanded] = useState(false);

  const actionable = suggestions.filter(
    (s) => s.status === "pending" || s.status === "conflict",
  );
  const pendingCount = suggestions.filter((s) => s.status === "pending").length;
  const conflictCount = suggestions.filter((s) => s.status === "conflict").length;

  if (loading) {
    return (
      <div className="pt-2 border-t border-black/[0.06]">
        <div className="flex items-center gap-2 py-2">
          <Loader2 size={12} className="animate-spin text-vitti-fg-muted/30" />
          <span className="text-[11px] text-vitti-fg-muted/40 font-light">
            Carregando sugestões...
          </span>
        </div>
      </div>
    );
  }

  if (actionable.length === 0) {
    return (
      <div className="pt-2 border-t border-black/[0.06]">
        <p className="text-[10px] font-medium text-vitti-fg-muted/65 uppercase tracking-wide mb-1">
          Sugestões
        </p>
        <p className="text-[11px] text-vitti-fg-muted/40 italic font-light">
          Nenhuma sugestão pendente.
        </p>
      </div>
    );
  }

  return (
    <div className="pt-2 border-t border-black/[0.06]">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 w-full text-left mb-2"
      >
        <span className="text-[10px] font-medium text-vitti-fg-muted/65 uppercase tracking-wide">
          Sugestões
        </span>
        {pendingCount > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-vitti-blue/10 text-vitti-blue/70 text-[9px] font-medium">
            {pendingCount} pendente{pendingCount !== 1 ? "s" : ""}
          </span>
        )}
        {conflictCount > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-600 text-[9px] font-medium">
            {conflictCount} conflito{conflictCount !== 1 ? "s" : ""}
          </span>
        )}
        <ChevronDown
          size={11}
          className={cn(
            "text-vitti-fg-muted/40 transition-transform ml-auto shrink-0",
            expanded && "rotate-180",
          )}
        />
      </button>

      {expanded && (
        <div className="space-y-2 max-h-[320px] overflow-y-auto pr-0.5">
          {actionable.map((sug) => (
            <SuggestionItem
              key={sug.id}
              sug={sug}
              onAccept={onAccept}
              onReject={onReject}
            />
          ))}
        </div>
      )}
    </div>
  );
}

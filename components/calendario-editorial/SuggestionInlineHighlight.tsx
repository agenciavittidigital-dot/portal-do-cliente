"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Pencil } from "lucide-react";
import type { SuggestionRow } from "@/lib/hooks/useEditorialSuggestions";

interface Props {
  text: string | null;
  suggestions: SuggestionRow[];
  field: "description" | "caption";
  canSuggest?: boolean;
  onSuggest?: (start: number, end: number, selectedText: string) => void;
}

type Segment =
  | { type: "text"; content: string; canonicalStart: number }
  | { type: "suggestion"; original: string; proposed: string | null; canonicalStart: number };

function buildSegments(
  text: string,
  pending: SuggestionRow[],
  field: "description" | "caption",
): Segment[] {
  const sorted = [...pending]
    .filter((s) => s.status === "pending" && s.field === field)
    .sort((a, b) => a.original_start - b.original_start);

  const segments: Segment[] = [];
  let cursor = 0;

  for (const sug of sorted) {
    if (sug.original_start < cursor) continue;
    if (sug.original_start >= text.length || sug.original_end > text.length) continue;

    if (sug.original_start > cursor) {
      segments.push({
        type: "text",
        content: text.slice(cursor, sug.original_start),
        canonicalStart: cursor,
      });
    }
    segments.push({
      type: "suggestion",
      original: text.slice(sug.original_start, sug.original_end),
      proposed: sug.proposed_text,
      canonicalStart: sug.original_start,
    });
    cursor = sug.original_end;
  }

  if (cursor < text.length) {
    segments.push({ type: "text", content: text.slice(cursor), canonicalStart: cursor });
  }

  return segments;
}

// Returns the canonical character offset for a given DOM node + nodeOffset.
// Only processes text nodes; element nodes return null (child index ≠ char offset).
// Returns null if the node is inside a proposed-text span (not part of canonical text).
function getCanonOffset(
  containerEl: HTMLElement,
  node: Node,
  nodeOffset: number,
): number | null {
  if (node.nodeType !== Node.TEXT_NODE) return null;

  const el = node.parentElement;
  if (!el) return null;

  // Proposed-text spans are not canonical — block selection endpoints inside them.
  if (el.closest("[data-seg-type='proposed']")) return null;

  const seg = el.closest("[data-canonical-start]") as HTMLElement | null;
  if (!seg || !containerEl.contains(seg)) return null;

  return parseInt(seg.dataset.canonicalStart!, 10) + nodeOffset;
}

function getSelectionOffsets(
  containerEl: HTMLElement,
  range: Range,
  canonicalText: string,
  pendingSuggestions: SuggestionRow[],
): { start: number; end: number; text: string } | null {
  if (
    !containerEl.contains(range.startContainer) ||
    !containerEl.contains(range.endContainer)
  ) {
    return null;
  }

  const start = getCanonOffset(containerEl, range.startContainer, range.startOffset);
  const end = getCanonOffset(containerEl, range.endContainer, range.endOffset);

  if (start === null || end === null || start >= end) return null;

  // Block selection that overlaps any existing pending suggestion.
  const hasOverlap = pendingSuggestions.some(
    (s) => s.original_start < end && s.original_end > start,
  );
  if (hasOverlap) return null;

  // Use canonical text as the source of truth, not range.toString().
  const selectedText = canonicalText.slice(start, end);

  return { start, end, text: selectedText };
}

export function SuggestionInlineHighlight({
  text,
  suggestions,
  field,
  canSuggest,
  onSuggest,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [buttonPos, setButtonPos] = useState<{ top: number; left: number } | null>(null);
  const [pendingSel, setPendingSel] = useState<{
    start: number;
    end: number;
    text: string;
  } | null>(null);

  const clearSel = useCallback(() => {
    setButtonPos(null);
    setPendingSel(null);
  }, []);

  useEffect(() => {
    if (!buttonPos) return;

    function onMouseDown(e: MouseEvent) {
      if (buttonRef.current?.contains(e.target as Node)) return;
      clearSel();
    }

    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [buttonPos, clearSel]);

  const displayText = text ?? "";

  const pendingSuggestions = suggestions.filter(
    (s) => s.status === "pending" && s.field === field,
  );

  function handleMouseUp() {
    if (!canSuggest || !displayText) return;
    const containerEl = containerRef.current;
    if (!containerEl) return;

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;

    const range = sel.getRangeAt(0);
    const offsets = getSelectionOffsets(containerEl, range, displayText, pendingSuggestions);
    if (!offsets || offsets.text.length < 2) return;

    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    setButtonPos({ top: rect.bottom + 6, left: rect.left });
    setPendingSel(offsets);
  }

  function handleSuggestClick() {
    if (pendingSel && onSuggest) {
      onSuggest(pendingSel.start, pendingSel.end, pendingSel.text);
    }
    clearSel();
    window.getSelection()?.removeAllRanges();
  }

  if (!displayText) {
    return (
      <span className="text-vitti-fg-muted/40 italic text-xs font-light">
        {field === "description" ? "Sem descrição" : "Sem legenda"}
      </span>
    );
  }

  const segments = buildSegments(displayText, pendingSuggestions, field);

  return (
    <div ref={containerRef} className="relative" onMouseUp={handleMouseUp}>
      <span className="whitespace-pre-wrap text-sm font-light text-vitti-fg leading-relaxed select-text">
        {segments.map((seg, i) => {
          if (seg.type === "text") {
            return (
              <span key={i} data-canonical-start={String(seg.canonicalStart)}>
                {seg.content}
              </span>
            );
          }
          return (
            <span key={i}>
              <span
                className="text-red-500 line-through"
                data-canonical-start={String(seg.canonicalStart)}
              >
                {seg.original}
              </span>
              {seg.proposed !== null && (
                <span className="text-red-500 ml-0.5" data-seg-type="proposed">
                  [{seg.proposed}]
                </span>
              )}
            </span>
          );
        })}
      </span>

      {buttonPos && pendingSel && typeof document !== "undefined" && createPortal(
        <div
          style={{
            position: "fixed",
            top: buttonPos.top,
            left: buttonPos.left,
            zIndex: 70,
          }}
        >
          <button
            ref={buttonRef}
            type="button"
            onClick={handleSuggestClick}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-vitti-blue text-white text-[10px] font-light shadow-lg hover:bg-vitti-blue/90 transition-colors"
          >
            <Pencil size={9} />
            Sugerir alteração
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}

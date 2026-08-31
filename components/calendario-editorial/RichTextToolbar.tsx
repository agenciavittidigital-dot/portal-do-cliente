"use client";

import React, { useState, useRef, useEffect } from "react";
import { Bold, Italic, Underline, List, ListOrdered, Highlighter, Palette } from "lucide-react";
import { COLOR_PALETTE } from "@/lib/editorial-rich-text";

interface RichTextToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

type WrapMode = "bold" | "italic" | "underline" | "highlight";
type ListMode = "bullet" | "ordered";

function wrapSelection(
  text: string,
  start: number,
  end: number,
  before: string,
  after: string
): { next: string; nextStart: number; nextEnd: number } {
  const selected = text.slice(start, end);
  const next = text.slice(0, start) + before + selected + after + text.slice(end);
  return { next, nextStart: start + before.length, nextEnd: start + before.length + selected.length };
}

function prefixLines(
  text: string,
  start: number,
  end: number,
  prefix: (i: number) => string
): { next: string; nextStart: number; nextEnd: number } {
  const before = text.slice(0, start);
  const selected = text.slice(start, end);
  const after = text.slice(end);
  const lines = selected.split("\n");
  const newLines = lines.map((l, i) => prefix(i) + l);
  const nextSelected = newLines.join("\n");
  return {
    next: before + nextSelected + after,
    nextStart: start,
    nextEnd: start + nextSelected.length,
  };
}

const COLOR_LABELS: Record<string, string> = {
  blue:  "Azul",
  red:   "Vermelho",
  green: "Verde",
  amber: "Âmbar",
  gray:  "Cinza",
};

export default function RichTextToolbar({ textareaRef, value, onChange, disabled }: RichTextToolbarProps) {
  const [showColors, setShowColors] = useState(false);
  const colorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (colorRef.current && !colorRef.current.contains(e.target as Node)) {
        setShowColors(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function applyWrap(mode: WrapMode) {
    const ta = textareaRef.current;
    if (!ta || disabled) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const map: Record<WrapMode, [string, string]> = {
      bold:      ["**", "**"],
      italic:    ["_",  "_" ],
      underline: ["__", "__"],
      highlight: ["==", "=="],
    };
    const [b, a] = map[mode];
    const { next, nextStart, nextEnd } = wrapSelection(value, start, end, b, a);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(nextStart, nextEnd);
    });
  }

  function applyList(mode: ListMode) {
    const ta = textareaRef.current;
    if (!ta || disabled) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const { next, nextStart, nextEnd } = prefixLines(
      value,
      start,
      end,
      (i) => (mode === "bullet" ? "- " : `${i + 1}. `)
    );
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(nextStart, nextEnd);
    });
  }

  function applyColor(colorKey: string) {
    const ta = textareaRef.current;
    if (!ta || disabled) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.slice(start, end) || "texto";
    const insert = `[${selected}]{:${colorKey}}`;
    const next = value.slice(0, start) + insert + value.slice(end);
    onChange(next);
    setShowColors(false);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start, start + insert.length);
    });
  }

  const btnBase =
    "p-1.5 rounded text-[#638ACC] hover:text-white hover:bg-[#455CAB]/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className="flex items-center gap-0.5 px-2 py-1 border-b border-white/10 bg-[#0a0f1e]/60">
      <button type="button" className={btnBase} disabled={disabled} onClick={() => applyWrap("bold")} title="Negrito (**texto**)">
        <Bold size={14} />
      </button>
      <button type="button" className={btnBase} disabled={disabled} onClick={() => applyWrap("italic")} title="Itálico (_texto_)">
        <Italic size={14} />
      </button>
      <button type="button" className={btnBase} disabled={disabled} onClick={() => applyWrap("underline")} title="Sublinhado (__texto__)">
        <Underline size={14} />
      </button>

      <div className="w-px h-4 bg-white/10 mx-1" />

      <button type="button" className={btnBase} disabled={disabled} onClick={() => applyList("bullet")} title="Lista com marcadores (- item)">
        <List size={14} />
      </button>
      <button type="button" className={btnBase} disabled={disabled} onClick={() => applyList("ordered")} title="Lista numerada (1. item)">
        <ListOrdered size={14} />
      </button>

      <div className="w-px h-4 bg-white/10 mx-1" />

      <button type="button" className={btnBase} disabled={disabled} onClick={() => applyWrap("highlight")} title="Destaque (==texto==)">
        <Highlighter size={14} />
      </button>

      <div className="relative" ref={colorRef}>
        <button
          type="button"
          className={btnBase}
          disabled={disabled}
          onClick={() => setShowColors((v) => !v)}
          title="Cor do texto ([texto]{:cor})"
        >
          <Palette size={14} />
        </button>
        {showColors && (
          <div className="absolute left-0 top-full mt-1 z-50 bg-[#171F38] border border-white/10 rounded-lg shadow-xl p-2 flex flex-col gap-1 min-w-[110px]">
            {Object.entries(COLOR_PALETTE).map(([key, hex]) => (
              <button
                key={key}
                type="button"
                className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white/5 text-xs text-white/80 transition-colors"
                onClick={() => applyColor(key)}
              >
                <span className="w-3 h-3 rounded-full inline-block border border-white/20" style={{ background: hex }} />
                {COLOR_LABELS[key]}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

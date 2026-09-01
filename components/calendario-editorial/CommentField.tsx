"use client";

import React, { useRef } from "react";
import RichTextToolbar from "./RichTextToolbar";

interface CommentFieldProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  disabled?: boolean;
  placeholder?: string;
  rows?: number;
  className?: string;
  variant?: "dark" | "light";
}

export default function CommentField({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = "Escreva um comentário...",
  rows = 3,
  className = "",
  variant = "dark",
}: CommentFieldProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isLight = variant === "light";

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && onSubmit) {
      e.preventDefault();
      onSubmit();
    }
  }

  const containerClass = isLight
    ? `rounded-lg border border-black/[0.1] overflow-hidden bg-white ${className}`
    : `rounded-lg border border-white/10 overflow-hidden bg-[#0a0f1e]/40 ${className}`;

  const textareaClass = isLight
    ? "w-full bg-transparent text-vitti-fg text-xs font-light px-3 py-2 resize-none focus:outline-none placeholder:text-vitti-fg-muted/35 disabled:opacity-50"
    : "w-full bg-transparent text-white/90 text-sm px-3 py-2 resize-none focus:outline-none placeholder:text-white/30 disabled:opacity-50";

  return (
    <div className={containerClass}>
      <RichTextToolbar
        textareaRef={textareaRef}
        value={value}
        onChange={onChange}
        disabled={disabled}
        variant={variant}
      />
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        rows={rows}
        className={textareaClass}
      />
    </div>
  );
}

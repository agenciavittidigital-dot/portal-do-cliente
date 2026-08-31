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
}

export default function CommentField({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = "Escreva um comentário...",
  rows = 3,
  className = "",
}: CommentFieldProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && onSubmit) {
      e.preventDefault();
      onSubmit();
    }
  }

  return (
    <div className={`rounded-lg border border-white/10 overflow-hidden bg-[#0a0f1e]/40 ${className}`}>
      <RichTextToolbar
        textareaRef={textareaRef}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        rows={rows}
        className="w-full bg-transparent text-white/90 text-sm px-3 py-2 resize-none focus:outline-none placeholder:text-white/30 disabled:opacity-50"
      />
    </div>
  );
}

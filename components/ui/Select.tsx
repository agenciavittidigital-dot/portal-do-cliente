"use client";

import React, { useState, useRef, useEffect, useId } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

type SelectSize = "sm" | "md" | "lg";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  options: SelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  size?: SelectSize;
  className?: string;
  triggerClassName?: string;
  prefix?: React.ReactNode;
  id?: string;
  name?: string;
}

// ── Size maps ────────────────────────────────────────────────────────────────

const triggerSizeClass: Record<SelectSize, string> = {
  sm: "px-2.5 py-1   text-[10px] rounded-lg gap-1.5",
  md: "px-3   py-1.5 text-xs     rounded-lg gap-2",
  lg: "px-3   py-2   text-sm     rounded-lg gap-2",
};

const optionSizeClass: Record<SelectSize, string> = {
  sm: "px-2.5 py-1.5 text-[10px]",
  md: "px-3   py-2   text-xs",
  lg: "px-3   py-2.5 text-sm",
};

const chevronSizeMap: Record<SelectSize, number> = {
  sm: 10,
  md: 11,
  lg: 12,
};

// ── Component ────────────────────────────────────────────────────────────────

export function Select({
  options,
  value = "",
  onChange,
  placeholder = "Selecione…",
  disabled = false,
  size = "md",
  className,
  triggerClassName,
  prefix,
  id,
  name,
}: SelectProps) {
  const [open,        setOpen]        = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef   = useRef<HTMLButtonElement>(null);
  const optionRefs   = useRef<(HTMLButtonElement | null)[]>([]);

  const uid       = useId();
  const listboxId = `${uid}-listbox`;
  const optionId  = (i: number) => `${uid}-opt-${i}`;

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selectedLabel = selectedIndex >= 0 ? options[selectedIndex].label : undefined;

  // ── Close on outside click ────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  // ── Scroll active option into view (keyboard navigation) ─────────────────
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  function openAt(idx: number) {
    if (options.length === 0) { setOpen(true); return; }
    setActiveIndex(Math.max(0, Math.min(idx, options.length - 1)));
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setActiveIndex(-1);
  }

  /** Confirms selection at given index, closes, returns focus to trigger. */
  function pick(idx: number) {
    if (idx >= 0 && idx < options.length) onChange?.(options[idx].value);
    close();
    triggerRef.current?.focus();
  }

  // ── Keyboard — trigger keeps focus throughout (combobox pattern) ──────────
  //
  //   When closed: Enter / Space / ArrowDown / ArrowUp → open
  //   When open:   Arrows → navigate  Enter/Space → confirm  Escape/Tab → close

  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;

    if (!open) {
      switch (e.key) {
        case "Enter":
        case " ":
        case "ArrowDown":
          e.preventDefault();
          openAt(selectedIndex >= 0 ? selectedIndex : 0);
          break;
        case "ArrowUp":
          e.preventDefault();
          openAt(selectedIndex >= 0 ? selectedIndex : options.length - 1);
          break;
      }
      return;
    }

    // open
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, options.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case "Home":
        e.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        e.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        pick(activeIndex);
        break;
      case "Escape":
        e.preventDefault();
        close();
        break;
      case "Tab":
        // Let Tab proceed; close silently.
        close();
        break;
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>

      {/* Hidden input for form name/value compatibility */}
      {name && <input type="hidden" name={name} value={value} readOnly />}

      {/* ── Trigger ──────────────────────────────────────────────────────── */}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-activedescendant={open && activeIndex >= 0 ? optionId(activeIndex) : undefined}
        disabled={disabled}
        onClick={() => (open ? close() : openAt(selectedIndex >= 0 ? selectedIndex : 0))}
        onKeyDown={handleKeyDown}
        className={cn(
          "w-full flex items-center justify-between text-left",
          "transition-colors duration-150 cursor-pointer",
          // Light
          "bg-white/80 border border-black/[0.08]",
          "hover:bg-white hover:border-black/[0.14]",
          "focus:outline-none focus:ring-1 focus:ring-vitti-blue/20 focus:border-vitti-blue/40",
          // Dark
          "dark:bg-[var(--surface-soft)] dark:border-[var(--border)]",
          "dark:hover:bg-[var(--surface-elevated)] dark:hover:border-[var(--border-strong)]",
          "dark:focus:ring-vitti-light/15 dark:focus:border-vitti-light/30",
          // Disabled
          "disabled:opacity-40 disabled:cursor-not-allowed",
          triggerSizeClass[size],
          triggerClassName,
        )}
      >
        {prefix}
        <span className={cn(
          "truncate font-light flex-1",
          selectedLabel
            ? "text-[#171f38]/80 dark:text-[var(--text-primary)]"
            : "text-[#171f38]/35 dark:text-[var(--text-muted)]",
        )}>
          {selectedLabel ?? placeholder}
        </span>
        <ChevronDown
          size={chevronSizeMap[size]}
          className={cn(
            "shrink-0 transition-transform duration-150",
            "text-[#5F6368]/50 dark:text-[var(--text-muted)]",
            open && "rotate-180",
          )}
        />
      </button>

      {/* ── Dropdown panel ───────────────────────────────────────────────── */}
      {open && (
        <div
          id={listboxId}
          role="listbox"
          className={cn(
            "absolute top-full left-0 right-0 mt-1 z-50",
            "py-1 max-h-[280px] overflow-y-auto",
            "rounded-xl border",
            "shadow-[0_8px_30px_rgba(0,0,0,0.10)]",
            // Light
            "bg-white border-black/[0.08]",
            // Dark
            "dark:bg-[var(--surface-elevated)] dark:border-[var(--border)]",
            "dark:shadow-[0_8px_30px_rgba(0,0,0,0.40)]",
          )}
        >
          {options.map((opt, i) => {
            const isSel    = opt.value === value;
            const isActive = i === activeIndex;

            return (
              <button
                key={opt.value}
                ref={(el) => { optionRefs.current[i] = el; }}
                id={optionId(i)}
                type="button"
                role="option"
                aria-selected={isSel}
                tabIndex={-1}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => pick(i)}
                className={cn(
                  "w-full text-left font-light transition-colors",
                  optionSizeClass[size],
                  // Active + selected
                  isActive && isSel  && "bg-vitti-blue/[0.10] text-vitti-blue dark:bg-[var(--selected)] dark:text-vitti-light",
                  // Active only (keyboard highlight)
                  isActive && !isSel && "bg-black/[0.04] text-[#171f38]/90 dark:bg-[var(--hover)] dark:text-[var(--text-primary)]",
                  // Selected only (no keyboard focus)
                  !isActive && isSel && "bg-vitti-blue/[0.06] text-vitti-blue dark:bg-[var(--selected)] dark:text-vitti-light",
                  // Default
                  !isActive && !isSel && "text-[#171f38]/80 hover:bg-black/[0.03] dark:text-[var(--text-secondary)] dark:hover:bg-[var(--hover)]",
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

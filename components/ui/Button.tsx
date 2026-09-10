import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

const variantStyles = {
  primary:
    "bg-vitti-blue hover:bg-vitti-blue/90 text-white border-transparent shadow-lg shadow-vitti-blue/10",
  secondary:
    "bg-black/5 dark:bg-white/[0.06] hover:bg-black/[0.08] dark:hover:bg-white/[0.09] text-[#111111]/70 dark:text-[var(--text-secondary)] border-black/10 dark:border-white/[0.10]",
  ghost:
    "bg-transparent hover:bg-black/5 dark:hover:bg-[var(--hover)] text-[#5F6368] dark:text-[var(--text-muted)] hover:text-[#111111] dark:hover:text-[var(--text-secondary)] border-transparent",
  danger:
    "bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20",
};

const sizeStyles = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-3 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg border font-light tracking-wide transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

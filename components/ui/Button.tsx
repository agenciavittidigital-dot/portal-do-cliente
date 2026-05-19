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
    "bg-white/5 hover:bg-white/10 text-white/80 border-white/10",
  ghost:
    "bg-transparent hover:bg-white/5 text-white/50 hover:text-white border-transparent",
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

import { cn } from "@/lib/utils";

interface BadgeProps {
  label: string;
  variant?: "default" | "success" | "warning" | "danger" | "info";
  className?: string;
}

const variantStyles: Record<NonNullable<BadgeProps["variant"]>, string> = {
  default: "bg-black/[0.05] dark:bg-white/[0.07] text-[#5F6368] dark:text-[var(--text-secondary)] border-black/[0.08] dark:border-white/[0.10]",
  success: "bg-emerald-500/10 dark:bg-emerald-500/[0.12] text-emerald-600 dark:text-emerald-400 border-emerald-500/20 dark:border-emerald-500/25",
  warning: "bg-amber-500/10 dark:bg-amber-500/[0.12] text-amber-600 dark:text-amber-400 border-amber-500/20 dark:border-amber-500/25",
  danger: "bg-red-500/10 dark:bg-red-500/[0.12] text-red-500 dark:text-red-400 border-red-500/20 dark:border-red-500/25",
  info: "bg-vitti-blue/10 dark:bg-vitti-light/[0.12] text-vitti-blue dark:text-vitti-light border-vitti-blue/20 dark:border-vitti-light/25",
};

export function Badge({
  label,
  variant = "default",
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-light tracking-wide border",
        variantStyles[variant],
        className
      )}
    >
      {label}
    </span>
  );
}

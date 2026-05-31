import { cn } from "@/lib/utils";

interface BadgeProps {
  label: string;
  variant?: "default" | "success" | "warning" | "danger" | "info";
  className?: string;
}

const variantStyles: Record<NonNullable<BadgeProps["variant"]>, string> = {
  default: "bg-black/[0.05] text-[#5F6368] border-black/[0.08]",
  success: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  warning: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  danger: "bg-red-500/10 text-red-500 border-red-500/20",
  info: "bg-vitti-blue/10 text-vitti-blue border-vitti-blue/20",
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

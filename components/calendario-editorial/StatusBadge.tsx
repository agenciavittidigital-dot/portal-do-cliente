import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  name: string;
  color: string;
  small?: boolean;
  className?: string;
}

export function StatusBadge({ name, color, small, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-light whitespace-nowrap",
        small ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]",
        className
      )}
      style={{ backgroundColor: `${color}18`, color }}
    >
      <span
        className="rounded-full shrink-0"
        style={{
          backgroundColor: color,
          width: 4,
          height: 4,
          display: "inline-block",
        }}
      />
      {name}
    </span>
  );
}

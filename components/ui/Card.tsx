import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface CardProps {
  className?: string;
  children: ReactNode;
}

export function Card({ className, children }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white dark:border-[var(--border)] p-5",
        "bg-white/60 dark:bg-[var(--glass)] backdrop-blur-xl",
        "shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.25)]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children }: CardProps) {
  return <div className={cn("mb-4", className)}>{children}</div>;
}

export function CardTitle({ className, children }: CardProps) {
  return (
    <h3
      className={cn(
        "text-sm font-semibold text-vitti-fg dark:text-[var(--text-primary)]",
        className
      )}
    >
      {children}
    </h3>
  );
}

export function CardContent({ className, children }: CardProps) {
  return <div className={cn("", className)}>{children}</div>;
}

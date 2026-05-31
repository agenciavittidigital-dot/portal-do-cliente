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
        "rounded-xl border p-5",
        "bg-vitti-gray/[0.08] border-vitti-gray/[0.14]",
        "backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.04)]",
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
        "text-xs font-light text-vitti-blue/60 tracking-widest uppercase",
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

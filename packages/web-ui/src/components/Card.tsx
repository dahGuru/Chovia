import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../tokens.js";

export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[#E2EBE6] bg-white shadow-[0_1px_3px_rgba(13,38,33,0.04)]",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-[#E2EBE6] px-5 py-4", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className={cn("text-base font-bold text-[#0D2621]", className)} {...rest}>
      {children}
    </h2>
  );
}

export function CardDescription({ className, children, ...rest }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("mt-0.5 text-xs text-[#64786E]", className)} {...rest}>
      {children}
    </p>
  );
}

export function CardContent({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("p-5", className)} {...rest}>
      {children}
    </div>
  );
}

export interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string | undefined;
  icon?: ReactNode | undefined;
  accent?: "green" | "gold" | "warning" | "error" | "neutral" | undefined;
}

const ACCENT_BG: Record<NonNullable<StatCardProps["accent"]>, string> = {
  green: "bg-[#235347]/10 text-[#235347]",
  gold: "bg-[#D4AF37]/15 text-[#9a7b15]",
  warning: "bg-amber-50 text-amber-700",
  error: "bg-red-50 text-red-600",
  neutral: "bg-[#F5F7F6] text-[#52665F]",
};

export function StatCard({ label, value, hint, icon, accent = "green" }: StatCardProps) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[#64786E]">{label}</p>
          <p className="mt-2 truncate text-2xl font-bold tracking-tight text-[#0D2621]">{value}</p>
          {hint && <p className="mt-1 text-xs text-[#52665F]">{hint}</p>}
        </div>
        {icon && (
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", ACCENT_BG[accent])}>
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}

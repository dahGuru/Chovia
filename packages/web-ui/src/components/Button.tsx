"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../tokens.js";

export type ButtonVariant = "primary" | "secondary" | "gold" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant | undefined;
  size?: ButtonSize | undefined;
  loading?: boolean | undefined;
  leftIcon?: ReactNode | undefined;
  rightIcon?: ReactNode | undefined;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-[#235347] text-white hover:bg-[#1b4137] focus-visible:ring-[#235347]/40 border border-transparent",
  secondary:
    "bg-[#0D2621] text-white hover:bg-[#173a32] focus-visible:ring-[#0D2621]/40 border border-transparent",
  gold:
    "bg-[#D4AF37] text-[#0D2621] hover:bg-[#c39f2d] focus-visible:ring-[#D4AF37]/40 border border-transparent font-semibold",
  outline:
    "bg-white text-[#0D2621] border border-[#E2EBE6] hover:bg-[#F5F7F6] focus-visible:ring-[#235347]/30",
  ghost:
    "bg-transparent text-[#52665F] hover:bg-[#E2EBE6]/60 hover:text-[#0D2621] border border-transparent focus-visible:ring-[#235347]/30",
  danger:
    "bg-[#EF4444] text-white hover:bg-[#dc2626] focus-visible:ring-[#EF4444]/40 border border-transparent",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs rounded-lg gap-1.5",
  md: "h-10 px-4 text-sm rounded-xl gap-2",
  lg: "h-11 px-5 text-sm rounded-xl gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  leftIcon,
  rightIcon,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  const isDisabled = Boolean(disabled || loading);

  return (
    <button
      type={type}
      disabled={isDisabled}
      className={cn(
        "inline-flex items-center justify-center font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-55 cursor-pointer",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className
      )}
      {...rest}
    >
      {loading ? (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      ) : (
        leftIcon
      )}
      <span>{children}</span>
      {!loading && rightIcon}
    </button>
  );
}

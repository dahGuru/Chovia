"use client";

import type { ReactNode } from "react";
import { cn } from "../tokens.js";
import { Button } from "./Button.js";
import { AlertIcon, RefreshIcon, ShieldIcon } from "./Icons.js";

export function LoadingSpinner({ label = "Loading...", className }: { label?: string | undefined; className?: string | undefined }) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 text-center", className)}>
      <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#E2EBE6] border-t-[#235347]" />
      <p className="mt-3 text-sm font-medium text-[#52665F]">{label}</p>
    </div>
  );
}

export function SkeletonBlock({ className }: { className?: string | undefined }) {
  return <div className={cn("animate-pulse rounded-xl bg-[#E2EBE6]/70", className)} />;
}

export function TableSkeleton({ rows = 5 }: { rows?: number | undefined }) {
  return (
    <div className="space-y-3 rounded-2xl border border-[#E2EBE6] bg-white p-5">
      <SkeletonBlock className="h-8 w-full" />
      {Array.from({ length: rows }).map((_, idx) => (
        <SkeletonBlock key={idx} className="h-12 w-full" />
      ))}
    </div>
  );
}

export interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string | undefined;
  onAction?: (() => void) | undefined;
  icon?: ReactNode | undefined;
  className?: string | undefined;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#E2EBE6] bg-white px-6 py-12 text-center",
        className
      )}
    >
      {icon && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F5F7F6] text-[#235347]">
          {icon}
        </div>
      )}
      <h3 className="text-base font-bold text-[#0D2621]">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm text-[#52665F]">{description}</p>
      {actionLabel && onAction && (
        <Button className="mt-4" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export interface ErrorStateProps {
  title?: string | undefined;
  message: string;
  onRetry?: (() => void) | undefined;
  className?: string | undefined;
}

export function ErrorState({
  title = "Unable to load data",
  message,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-red-200 bg-red-50/70 px-6 py-10 text-center",
        className
      )}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-100 text-[#EF4444]">
        <AlertIcon size={20} />
      </div>
      <h3 className="mt-3 text-base font-bold text-[#0D2621]">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-[#52665F]">{message}</p>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={onRetry}
          leftIcon={<RefreshIcon size={14} />}
        >
          Try again
        </Button>
      )}
    </div>
  );
}

export interface UnauthorizedStateProps {
  title?: string | undefined;
  description?: string | undefined;
  actionLabel?: string | undefined;
  onAction?: (() => void) | undefined;
}

export function UnauthorizedState({
  title = "Access denied",
  description = "Your account does not have permission to view this workspace.",
  actionLabel,
  onAction,
}: UnauthorizedStateProps) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center justify-center rounded-2xl border border-[#E2EBE6] bg-white px-6 py-12 text-center shadow-sm">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
        <ShieldIcon size={22} />
      </div>
      <h2 className="mt-4 text-lg font-bold text-[#0D2621]">{title}</h2>
      <p className="mt-1.5 text-sm text-[#52665F]">{description}</p>
      {actionLabel && onAction && (
        <Button className="mt-5" variant="secondary" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

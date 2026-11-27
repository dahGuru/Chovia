"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { cn } from "../tokens.js";
import { AlertIcon, CheckIcon, CloseIcon } from "./Icons.js";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  description?: string | undefined;
}

interface ToastContextValue {
  pushToast: (toast: Omit<ToastItem, "id">) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_STYLES: Record<ToastType, string> = {
  success: "border-emerald-200 bg-white text-[#0D2621]",
  error: "border-red-200 bg-white text-[#0D2621]",
  warning: "border-amber-200 bg-white text-[#0D2621]",
  info: "border-[#E2EBE6] bg-white text-[#0D2621]",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (toast: Omit<ToastItem, "id">) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-4), { ...toast, id }]);
      setTimeout(() => dismiss(id), 4500);
    },
    [dismiss]
  );

  const value: ToastContextValue = {
    pushToast,
    success: (title, description) => pushToast({ type: "success", title, description }),
    error: (title, description) => pushToast({ type: "error", title, description }),
    warning: (title, description) => pushToast({ type: "warning", title, description }),
    info: (title, description) => pushToast({ type: "info", title, description }),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2.5 px-4 sm:px-0"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-xl border p-3.5 shadow-lg",
              TOAST_STYLES[t.type]
            )}
          >
            <div className="mt-0.5 shrink-0">
              {t.type === "success" ? (
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <CheckIcon size={14} />
                </span>
              ) : t.type === "error" || t.type === "warning" ? (
                <span
                  className={cn(
                    "inline-flex h-6 w-6 items-center justify-center rounded-full",
                    t.type === "error" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700"
                  )}
                >
                  <AlertIcon size={14} />
                </span>
              ) : (
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#235347]/10 text-[#235347]">
                  <CheckIcon size={14} />
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[#0D2621]">{t.title}</p>
              {t.description && <p className="mt-0.5 text-xs text-[#52665F]">{t.description}</p>}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="rounded p-1 text-[#64786E] hover:bg-[#F5F7F6] hover:text-[#0D2621] cursor-pointer"
            >
              <CloseIcon size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}

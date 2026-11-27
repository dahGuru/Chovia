"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "../tokens.js";
import { Button } from "./Button.js";
import { FormField, Textarea } from "./FormControls.js";
import { CloseIcon } from "./Icons.js";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string | undefined;
  children: ReactNode;
  footer?: ReactNode | undefined;
  maxWidthClass?: string | undefined;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidthClass = "max-w-lg",
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0D2621]/50 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="chovia-modal-title"
    >
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div
        className={cn(
          "relative z-10 flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl border border-[#E2EBE6] bg-white shadow-xl",
          maxWidthClass
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#E2EBE6] px-6 py-4">
          <div>
            <h3 id="chovia-modal-title" className="text-base font-bold text-[#0D2621]">
              {title}
            </h3>
            {description && <p className="mt-0.5 text-xs text-[#64786E]">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1.5 text-[#64786E] hover:bg-[#F5F7F6] hover:text-[#0D2621] cursor-pointer"
          >
            <CloseIcon size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-[#E2EBE6] bg-[#F5F7F6]/60 px-6 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => void | Promise<void>;
  title: string;
  description: string;
  confirmLabel?: string | undefined;
  cancelLabel?: string | undefined;
  variant?: "primary" | "danger" | undefined;
  loading?: boolean | undefined;
  requireReason?: boolean | undefined;
  reasonLabel?: string | undefined;
  reasonPlaceholder?: string | undefined;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "primary",
  loading = false,
  requireReason = false,
  reasonLabel = "Reason",
  reasonPlaceholder = "Enter a reason...",
}: ConfirmDialogProps) {
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!open) {
      setReason("");
      setReasonError(undefined);
    }
  }, [open]);

  const handleConfirm = async () => {
    const trimmed = reason.trim();
    if (requireReason && trimmed.length < 3) {
      setReasonError("Please enter a reason (at least 3 characters).");
      return;
    }
    setReasonError(undefined);
    await onConfirm(trimmed || undefined);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      maxWidthClass="max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant === "danger" ? "danger" : "primary"}
            onClick={() => void handleConfirm()}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-[#52665F]">{description}</p>
      {requireReason && (
        <FormField label={reasonLabel} required error={reasonError} className="mt-4">
          <Textarea
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (reasonError) setReasonError(undefined);
            }}
            placeholder={reasonPlaceholder}
            hasError={Boolean(reasonError)}
          />
        </FormField>
      )}
    </Modal>
  );
}

import { cn } from "../tokens.js";

export type BadgeTone = "green" | "emerald" | "gold" | "amber" | "red" | "blue" | "slate";

const TONE_CLASSES: Record<BadgeTone, string> = {
  green: "bg-[#235347]/10 text-[#235347] border-[#235347]/20",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  gold: "bg-[#D4AF37]/15 text-[#8a6a0e] border-[#D4AF37]/30",
  amber: "bg-amber-50 text-amber-800 border-amber-200",
  red: "bg-red-50 text-red-700 border-red-200",
  blue: "bg-sky-50 text-sky-700 border-sky-200",
  slate: "bg-slate-100 text-slate-700 border-slate-200",
};

const STATUS_MAP: Record<string, { label: string; tone: BadgeTone }> = {
  // Orders
  PENDING_PAYMENT: { label: "Awaiting Payment", tone: "slate" },
  PENDING: { label: "Pending", tone: "amber" },
  CONFIRMED: { label: "New Order", tone: "blue" },
  PREPARING: { label: "Preparing", tone: "gold" },
  READY: { label: "Ready for Pickup", tone: "green" },
  ASSIGNED: { label: "Rider Assigned", tone: "blue" },
  OUT_FOR_DELIVERY: { label: "Out for Delivery", tone: "blue" },
  DELIVERED: { label: "Delivered", tone: "emerald" },
  REJECTED: { label: "Rejected", tone: "red" },
  CANCELLED: { label: "Cancelled", tone: "red" },

  // Restaurant / User / Rider / Config
  ACTIVE: { label: "Active", tone: "emerald" },
  INACTIVE: { label: "Inactive", tone: "slate" },
  PENDING_APPROVAL: { label: "Pending Approval", tone: "amber" },
  SUSPENDED: { label: "Suspended", tone: "red" },
  DEACTIVATED: { label: "Deactivated", tone: "slate" },

  // Availability
  OPEN: { label: "Open", tone: "emerald" },
  CLOSED: { label: "Closed", tone: "slate" },
  AVAILABLE: { label: "Available", tone: "emerald" },
  UNAVAILABLE: { label: "Sold Out", tone: "red" },

  // KYC
  NOT_SUBMITTED: { label: "Not Submitted", tone: "slate" },
  UNDER_REVIEW: { label: "Under Review", tone: "amber" },
  APPROVED: { label: "Approved", tone: "emerald" },

  // Payments & Refunds
  SUCCESS: { label: "Paid", tone: "emerald" },
  FAILED: { label: "Failed", tone: "red" },
  ABANDONED: { label: "Abandoned", tone: "slate" },
  REFUND_PENDING: { label: "Refund Pending", tone: "amber" },
  PROCESSING: { label: "Processing", tone: "blue" },
  REFUNDED: { label: "Refunded", tone: "emerald" },
};

export interface StatusBadgeProps {
  status: string;
  label?: string | undefined;
  tone?: BadgeTone | undefined;
  className?: string | undefined;
}

export function StatusBadge({ status, label, tone, className }: StatusBadgeProps) {
  const mapped = STATUS_MAP[status];
  const resolvedTone = tone ?? mapped?.tone ?? "slate";
  const resolvedLabel = label ?? mapped?.label ?? status.replaceAll("_", " ");

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        TONE_CLASSES[resolvedTone],
        className
      )}
    >
      {resolvedLabel}
    </span>
  );
}

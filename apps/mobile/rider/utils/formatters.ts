export function formatNairaFromMinor(amountMinor: number): string {
  const amount = amountMinor / 100;
  return `₦${amount.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatShortDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString("en-NG", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const DELIVERY_STATUS_META: Record<
  string,
  { label: string; bgClass: string; textClass: string }
> = {
  READY: {
    label: "Ready for Pickup",
    bgClass: "bg-amber-100",
    textClass: "text-amber-800",
  },
  ASSIGNED: {
    label: "Head to Restaurant",
    bgClass: "bg-blue-100",
    textClass: "text-blue-800",
  },
  OUT_FOR_DELIVERY: {
    label: "Delivering to Customer",
    bgClass: "bg-emerald-100",
    textClass: "text-chovia-green",
  },
  DELIVERED: {
    label: "Completed",
    bgClass: "bg-emerald-100",
    textClass: "text-emerald-800",
  },
};

export function getDeliveryStatusMeta(status: string) {
  return (
    DELIVERY_STATUS_META[status] ?? {
      label: status.replace(/_/g, " "),
      bgClass: "bg-slate-100",
      textClass: "text-slate-700",
    }
  );
}

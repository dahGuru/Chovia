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

export const ORDER_STATUS_META: Record<
  string,
  { label: string; bgClass: string; textClass: string }
> = {
  PENDING_PAYMENT: {
    label: "Awaiting Payment",
    bgClass: "bg-amber-100",
    textClass: "text-amber-800",
  },
  PENDING: {
    label: "Order Placed",
    bgClass: "bg-amber-100",
    textClass: "text-amber-800",
  },
  CONFIRMED: {
    label: "Confirmed",
    bgClass: "bg-emerald-100",
    textClass: "text-emerald-800",
  },
  PREPARING: {
    label: "Preparing",
    bgClass: "bg-blue-100",
    textClass: "text-blue-800",
  },
  READY: {
    label: "Ready for Pickup",
    bgClass: "bg-indigo-100",
    textClass: "text-indigo-800",
  },
  ASSIGNED: {
    label: "Rider Assigned",
    bgClass: "bg-purple-100",
    textClass: "text-purple-800",
  },
  OUT_FOR_DELIVERY: {
    label: "On the Way",
    bgClass: "bg-emerald-100",
    textClass: "text-chovia-green",
  },
  DELIVERED: {
    label: "Delivered",
    bgClass: "bg-emerald-100",
    textClass: "text-emerald-800",
  },
  CANCELLED: {
    label: "Cancelled",
    bgClass: "bg-red-100",
    textClass: "text-red-700",
  },
  REJECTED: {
    label: "Rejected",
    bgClass: "bg-red-100",
    textClass: "text-red-700",
  },
};

export function getOrderStatusMeta(status: string) {
  return (
    ORDER_STATUS_META[status] ?? {
      label: status.replace(/_/g, " "),
      bgClass: "bg-slate-100",
      textClass: "text-slate-700",
    }
  );
}

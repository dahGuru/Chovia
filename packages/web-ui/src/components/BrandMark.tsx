import { cn } from "../tokens.js";

export interface BrandMarkProps {
  portalLabel?: string | undefined;
  inverted?: boolean | undefined;
  className?: string | undefined;
}

export function BrandMark({ portalLabel, inverted = false, className }: BrandMarkProps) {
  return (
    <div className={cn("inline-flex items-center gap-2.5", className)}>
      <div
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-xl font-bold tracking-tight shadow-sm",
          inverted ? "bg-white/10 text-white" : "bg-[#235347] text-white"
        )}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 3C7.03 3 3 7.03 3 12s4.03 9 9 9c2.8 0 5.3-1.28 6.95-3.28l-2.4-1.92A6 6 0 1 1 16.5 8.18l2.42-1.92C17.27 4.26 14.78 3 12 3Z"
            fill="currentColor"
          />
          <circle cx="18" cy="12" r="2.2" fill="#D4AF37" />
        </svg>
      </div>
      <div className="flex flex-col">
        <span
          className={cn(
            "text-base font-extrabold tracking-tight leading-none",
            inverted ? "text-white" : "text-[#0D2621]"
          )}
        >
          CHOVIA
        </span>
        {portalLabel && (
          <span
            className={cn(
              "mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] leading-none",
              inverted ? "text-[#D4AF37]" : "text-[#235347]"
            )}
          >
            {portalLabel}
          </span>
        )}
      </div>
    </div>
  );
}

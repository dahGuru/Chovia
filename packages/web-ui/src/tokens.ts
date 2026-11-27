export const CHOVIA_COLORS = {
  primary: "#235347",
  deep: "#0D2621",
  gold: "#D4AF37",
  background: "#F5F7F6",
  white: "#FFFFFF",
  muted: "#52665F",
  subtle: "#64786E",
  border: "#E2EBE6",
  dotInactive: "#D2DDD8",
  neon: "#0AFF70",
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
} as const;

export const CHOVIA_RADII = {
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "24px",
  full: "9999px",
} as const;

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

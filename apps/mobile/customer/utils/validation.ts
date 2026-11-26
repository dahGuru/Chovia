export const AUTH_CONSTRAINTS = {
  password: {
    minLength: 8,
    maxLength: 100,
    pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).*$/,
    message:
      "Password must be at least 8 characters long and contain uppercase, lowercase, and numbers.",
  },
  email: {
    pattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    maxLength: 255,
  },
  phone: {
    pattern: /^\+?[1-9]\d{7,14}$/,
    message: "Phone number must be a valid E.164 formatted number.",
  },
  otp: {
    length: 6,
    pattern: /^\d{6}$/,
  },
} as const;

export const GEOSPATIAL_CONSTRAINTS = {
  latitude: { min: -90, max: 90 },
  longitude: { min: -180, max: 180 },
} as const;

const E164_STRICT_REGEX = /^\+[1-9]\d{7,14}$/;
const NG_LOCAL_REGEX = /^0[1-9]\d{9}$/;
const NG_NO_PLUS_REGEX = /^234[1-9]\d{9}$/;

export function normalizeNigerianPhone(raw: string): string | null {
  if (typeof raw !== "string") {
    return null;
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const compact = trimmed.replace(/[\s\-().]/g, "");
  if (!/^\+?\d+$/.test(compact)) {
    return null;
  }

  if (compact.startsWith("+")) {
    if (compact.startsWith("+2340")) {
      return null;
    }
    return E164_STRICT_REGEX.test(compact) ? compact : null;
  }

  if (NG_LOCAL_REGEX.test(compact)) {
    return `+234${compact.slice(1)}`;
  }

  if (NG_NO_PLUS_REGEX.test(compact)) {
    return `+${compact}`;
  }

  return null;
}

export function isValidNormalizedPhone(raw: string): boolean {
  return normalizeNigerianPhone(raw) !== null;
}

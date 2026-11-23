/**
 * Shared validation rules and constraints for CHOVIA.
 *
 * This package exports framework-agnostic constraints, regular expressions,
 * and pure validator functions used across backend (Zod 4), web (Zod 4),
 * and mobile (Zod 3) boundaries without introducing cross-version runtime conflicts.
 */

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

export const MONETARY_CONSTRAINTS = {
  currency: "NGN",
  minOrderAmountMinor: 10000,
  maxOrderAmountMinor: 50000000,
} as const;

export function isValidEmail(email: string): boolean {
  return (
    typeof email === "string" &&
    AUTH_CONSTRAINTS.email.pattern.test(email) &&
    email.length <= AUTH_CONSTRAINTS.email.maxLength
  );
}

export function isValidPhoneNumber(phone: string): boolean {
  return typeof phone === "string" && AUTH_CONSTRAINTS.phone.pattern.test(phone);
}

export function isValidLatitude(lat: number): boolean {
  return (
    typeof lat === "number" &&
    !isNaN(lat) &&
    lat >= GEOSPATIAL_CONSTRAINTS.latitude.min &&
    lat <= GEOSPATIAL_CONSTRAINTS.latitude.max
  );
}

export function isValidLongitude(lng: number): boolean {
  return (
    typeof lng === "number" &&
    !isNaN(lng) &&
    lng >= GEOSPATIAL_CONSTRAINTS.longitude.min &&
    lng <= GEOSPATIAL_CONSTRAINTS.longitude.max
  );
}

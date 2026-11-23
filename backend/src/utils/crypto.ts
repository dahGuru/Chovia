import crypto from "node:crypto";
import { env } from "../config/env.js";

/**
 * Generates a high-entropy random hex token (default 32 bytes / 64 hex chars).
 */
export function generateSecureToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

/**
 * Generates a unique family ID for refresh-token family rotation.
 */
export function generateFamilyId(): string {
  return crypto.randomUUID();
}

/**
 * 6-digit numeric OTP generation.
 */
export function generateNumericOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}

export type OtpAction = "VERIFY_EMAIL" | "PASSWORD_RESET";

/**
 * Generates a signed OTP payload token.
 * Format: `<expiresAt>.<hmac>`
 */
export function createOtpSignature(
  email: string,
  otp: string,
  action: OtpAction,
  expiresInMinutes = env.OTP_EXPIRES_IN_MINUTES
): { otp: string; signedToken: string; expiresAt: Date } {
  const expiresAtMs = Date.now() + expiresInMinutes * 60 * 1000;
  const data = `${email.toLowerCase()}:${otp}:${action}:${expiresAtMs}`;
  const hmac = crypto
    .createHmac("sha256", env.OTP_HMAC_SECRET)
    .update(data)
    .digest("hex");
  
  return {
    otp,
    signedToken: `${expiresAtMs}.${hmac}`,
    expiresAt: new Date(expiresAtMs),
  };
}

/**
 * Verifies a signed OTP token against email, submitted OTP, and action.
 */
export function verifyOtpSignature(
  email: string,
  submittedOtp: string,
  action: OtpAction,
  signedToken: string
): { valid: boolean; reason?: "EXPIRED" | "INVALID_SIGNATURE" | "MALFORMED" } {
  const parts = signedToken.split(".");
  if (parts.length !== 2) {
    return { valid: false, reason: "MALFORMED" };
  }

  const expiresAtStr = parts[0];
  const signature = parts[1];
  if (!expiresAtStr || !signature) {
    return { valid: false, reason: "MALFORMED" };
  }

  const expiresAtMs = Number.parseInt(expiresAtStr, 10);
  if (Number.isNaN(expiresAtMs)) {
    return { valid: false, reason: "MALFORMED" };
  }

  if (Date.now() > expiresAtMs) {
    return { valid: false, reason: "EXPIRED" };
  }

  const expectedData = `${email.toLowerCase()}:${submittedOtp}:${action}:${expiresAtMs}`;
  const expectedHmac = crypto
    .createHmac("sha256", env.OTP_HMAC_SECRET)
    .update(expectedData)
    .digest("hex");

  try {
    const expectedBuf = Buffer.from(expectedHmac, "hex");
    const actualBuf = Buffer.from(signature, "hex");
    if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
      return { valid: false, reason: "INVALID_SIGNATURE" };
    }
  } catch {
    return { valid: false, reason: "INVALID_SIGNATURE" };
  }

  return { valid: true };
}

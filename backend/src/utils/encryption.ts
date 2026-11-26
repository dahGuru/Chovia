import crypto from "node:crypto";
import { env } from "../config/env.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;
const PAYLOAD_VERSION = "v1";

/**
 * Parses a 64-character hex string into a 32-byte AES-256 key buffer.
 */
export function parseEncryptionKey(hexKey: string): Buffer {
  const normalized = hexKey.trim();
  if (!/^[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error("KYC_ENCRYPTION_KEY must be a valid 64-character hexadecimal string (32 bytes)");
  }
  return Buffer.from(normalized, "hex");
}

function getActiveEncryptionKey(overrideKeyHex?: string): Buffer {
  const keyHex = overrideKeyHex ?? env.KYC_ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error("KYC_ENCRYPTION_KEY is not configured");
  }
  return parseEncryptionKey(keyHex);
}

/**
 * Encrypts sensitive PII/financial text using AES-256-GCM authenticated encryption.
 * Stored format: `v1:<iv_base64>:<authTag_base64>:<ciphertext_base64>`
 */
export function encryptSensitiveValue(plaintext: string, keyHex?: string): string {
  const value = plaintext.trim();
  if (!value) {
    throw new Error("Cannot encrypt an empty sensitive value");
  }

  const key = getActiveEncryptionKey(keyHex);
  const iv = crypto.randomBytes(IV_LENGTH_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  });

  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${PAYLOAD_VERSION}:${iv.toString("base64")}:${authTag.toString("base64")}:${ciphertext.toString("base64")}`;
}

/**
 * Decrypts a payload produced by `encryptSensitiveValue`.
 * Throws if the ciphertext, IV, or authentication tag has been tampered with or the key mismatches.
 */
export function decryptSensitiveValue(encryptedPayload: string, keyHex?: string): string {
  const parts = encryptedPayload.split(":");
  if (parts.length !== 4 || parts[0] !== PAYLOAD_VERSION) {
    throw new Error("Invalid encrypted payload format");
  }

  const [, ivB64, authTagB64, ciphertextB64] = parts;
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error("Corrupted encrypted payload");
  }

  const key = getActiveEncryptionKey(keyHex);
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");

  if (iv.length !== IV_LENGTH_BYTES || authTag.length !== AUTH_TAG_LENGTH_BYTES) {
    throw new Error("Invalid IV or authentication tag length");
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  });
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

/**
 * Returns a masked representation preserving only the trailing 4 characters (e.g. "******5678").
 */
export function maskSensitiveDigits(value: string, visibleDigits = 4): string {
  const trimmed = value.trim();
  if (trimmed.length <= visibleDigits) {
    return "*".repeat(trimmed.length);
  }
  const maskLength = Math.max(4, trimmed.length - visibleDigits);
  return `${"*".repeat(maskLength)}${trimmed.slice(-visibleDigits)}`;
}

import { describe, expect, it } from "vitest";
import {
  decryptSensitiveValue,
  encryptSensitiveValue,
  maskSensitiveDigits,
  parseEncryptionKey,
} from "../utils/encryption.js";

const TEST_KEY_HEX = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const OTHER_KEY_HEX = "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";

describe("AES-256-GCM Sensitive KYC Encryption", () => {
  it("encrypts and decrypts government ID numbers and bank account numbers faithfully", () => {
    const nin = "12345678901";
    const bankAccount = "0123456789";

    const encryptedNin = encryptSensitiveValue(nin, TEST_KEY_HEX);
    const encryptedBank = encryptSensitiveValue(bankAccount, TEST_KEY_HEX);

    expect(encryptedNin).not.toContain(nin);
    expect(encryptedNin.startsWith("v1:")).toBe(true);
    expect(encryptedNin.split(":")).toHaveLength(4);

    expect(decryptSensitiveValue(encryptedNin, TEST_KEY_HEX)).toBe(nin);
    expect(decryptSensitiveValue(encryptedBank, TEST_KEY_HEX)).toBe(bankAccount);
  });

  it("uses unique random IVs per encryption call", () => {
    const value = "12345678901";
    const c1 = encryptSensitiveValue(value, TEST_KEY_HEX);
    const c2 = encryptSensitiveValue(value, TEST_KEY_HEX);

    expect(c1).not.toBe(c2);
    expect(decryptSensitiveValue(c1, TEST_KEY_HEX)).toBe(value);
    expect(decryptSensitiveValue(c2, TEST_KEY_HEX)).toBe(value);
  });

  it("fails authentication if ciphertext, auth tag, or key is tampered with", () => {
    const encrypted = encryptSensitiveValue("98765432109", TEST_KEY_HEX);
    const parts = encrypted.split(":");
    const tamperedCiphertext = `${parts[0]}:${parts[1]}:${parts[2]}:AAAA`;

    expect(() => decryptSensitiveValue(tamperedCiphertext, TEST_KEY_HEX)).toThrow();
    expect(() => decryptSensitiveValue(encrypted, OTHER_KEY_HEX)).toThrow();
    expect(() => decryptSensitiveValue("invalid-payload", TEST_KEY_HEX)).toThrow();
  });

  it("rejects malformed encryption keys", () => {
    expect(() => parseEncryptionKey("short-key")).toThrow();
    expect(() => parseEncryptionKey("g".repeat(64))).toThrow();
    expect(() => encryptSensitiveValue("   ", TEST_KEY_HEX)).toThrow();
  });

  it("masks sensitive digits preserving only the trailing 4 characters", () => {
    expect(maskSensitiveDigits("12345678901")).toBe("*******8901");
    expect(maskSensitiveDigits("0123456789")).toBe("******6789");
    expect(maskSensitiveDigits("1234")).toBe("****");
  });
});

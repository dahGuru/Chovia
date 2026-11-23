import { describe, it, expect } from "vitest";
import { hashPassword, comparePassword } from "../utils/password.js";
import {
  generateSecureToken,
  generateFamilyId,
  generateNumericOtp,
  createOtpSignature,
  verifyOtpSignature,
} from "../utils/crypto.js";

describe("Password Hashing & Verification (bcrypt)", () => {
  it("should hash a password and verify it correctly", async () => {
    const rawPassword = "SecurePassword123!";
    const hash = await hashPassword(rawPassword);

    expect(hash).toBeDefined();
    expect(hash).not.toBe(rawPassword);
    expect(hash.startsWith("$2")).toBe(true);

    const isMatch = await comparePassword(rawPassword, hash);
    expect(isMatch).toBe(true);

    const isWrong = await comparePassword("WrongPassword123!", hash);
    expect(isWrong).toBe(false);
  });
});

describe("Cryptographic Utilities & OTP Signature Verification", () => {
  it("should generate secure tokens and family IDs", () => {
    const token = generateSecureToken(32);
    expect(token).toBeDefined();
    expect(token.length).toBe(64); // 32 bytes in hex = 64 characters

    const familyId = generateFamilyId();
    expect(familyId).toBeDefined();
    expect(familyId.length).toBe(36); // UUID v4 format
  });

  it("should generate 6-digit numeric OTPs", () => {
    for (let i = 0; i < 10; i++) {
      const otp = generateNumericOtp();
      expect(otp).toMatch(/^\d{6}$/);
    }
  });

  it("should verify a valid OTP signature correctly", () => {
    const email = "customer@chovia.app";
    const otp = "123456";
    const { signedToken } = createOtpSignature(email, otp, "VERIFY_EMAIL", 10);

    const result = verifyOtpSignature(email, otp, "VERIFY_EMAIL", signedToken);
    expect(result.valid).toBe(true);
  });

  it("should reject an invalid OTP value", () => {
    const email = "customer@chovia.app";
    const otp = "123456";
    const { signedToken } = createOtpSignature(email, otp, "VERIFY_EMAIL", 10);

    const result = verifyOtpSignature(email, "654321", "VERIFY_EMAIL", signedToken);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("INVALID_SIGNATURE");
  });

  it("should reject a wrong OTP action", () => {
    const email = "customer@chovia.app";
    const otp = "123456";
    const { signedToken } = createOtpSignature(email, otp, "VERIFY_EMAIL", 10);

    const result = verifyOtpSignature(email, otp, "PASSWORD_RESET", signedToken);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("INVALID_SIGNATURE");
  });

  it("should reject an expired OTP", () => {
    const email = "customer@chovia.app";
    const otp = "123456";
    // -1 minute = already expired
    const { signedToken } = createOtpSignature(email, otp, "VERIFY_EMAIL", -1);

    const result = verifyOtpSignature(email, otp, "VERIFY_EMAIL", signedToken);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("EXPIRED");
  });
});

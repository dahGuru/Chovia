import { describe, expect, it } from "vitest";
import {
  AUTH_CONSTRAINTS,
  isValidEmail,
  isValidPhoneNumber,
  normalizeNigerianPhone,
  isValidLatitude,
  isValidLongitude,
} from "./index.js";

describe("Shared Validation Constraints", () => {
  it("validates well-formed email addresses", () => {
    expect(isValidEmail("user@chovia.ng")).toBe(true);
    expect(isValidEmail("invalid-email")).toBe(false);
  });

  it("validates E.164 phone numbers", () => {
    expect(isValidPhoneNumber("+2348012345678")).toBe(true);
    expect(isValidPhoneNumber("not-a-phone")).toBe(false);
  });

  it("normalizes Nigerian local and E.164 numbers safely", () => {
    expect(normalizeNigerianPhone("08054093095")).toBe("+2348054093095");
    expect(normalizeNigerianPhone("0805 409 3095")).toBe("+2348054093095");
    expect(normalizeNigerianPhone("0901-234-5678")).toBe("+2349012345678");
    expect(normalizeNigerianPhone("2348054093095")).toBe("+2348054093095");
    expect(normalizeNigerianPhone("+2348054093095")).toBe("+2348054093095");
    expect(normalizeNigerianPhone("+447911123456")).toBe("+447911123456");
    expect(normalizeNigerianPhone("0805409")).toBeNull();
    expect(normalizeNigerianPhone("00054093095")).toBeNull();
    expect(normalizeNigerianPhone("+23408054093095")).toBeNull();
    expect(normalizeNigerianPhone("abc-1234567")).toBeNull();
    expect(normalizeNigerianPhone("")).toBeNull();
  });

  it("validates coordinate boundaries", () => {
    expect(isValidLatitude(6.5244)).toBe(true);
    expect(isValidLatitude(95)).toBe(false);
    expect(isValidLongitude(3.3792)).toBe(true);
    expect(isValidLongitude(190)).toBe(false);
  });

  it("exports required auth constraints", () => {
    expect(AUTH_CONSTRAINTS.password.minLength).toBe(8);
    expect(AUTH_CONSTRAINTS.otp.length).toBe(6);
  });
});

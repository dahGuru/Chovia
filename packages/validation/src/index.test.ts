import { describe, expect, it } from "vitest";
import {
  AUTH_CONSTRAINTS,
  isValidEmail,
  isValidPhoneNumber,
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

import { describe, it, expect } from "vitest";
import { AxiosError, AxiosHeaders } from "axios";
import {
  CHOVIA_COLORS,
  cn,
  formatNairaFromMinor,
  normalizeApiError,
  ApiClientError,
  validateSameOriginAndCsrf,
  parseCookieValue,
  buildRefreshCookieHeader,
} from "./index.js";

describe("@chovia/web-ui shared utilities", () => {
  it("exposes CHOVIA brand design tokens", () => {
    expect(CHOVIA_COLORS.primary).toBe("#235347");
    expect(CHOVIA_COLORS.deep).toBe("#0D2621");
    expect(CHOVIA_COLORS.gold).toBe("#D4AF37");
    expect(CHOVIA_COLORS.background).toBe("#F5F7F6");
  });

  it("merges class names cleanly", () => {
    expect(cn("base", false, undefined, "active")).toBe("base active");
  });

  it("formats kobo minor units to NGN currency", () => {
    const formatted = formatNairaFromMinor(450050);
    expect(formatted).toContain("4,500.50");
  });

  it("normalizes Axios backend errors into ApiClientError", () => {
    const axiosErr = new AxiosError(
      "Request failed",
      "ERR_BAD_REQUEST",
      undefined,
      undefined,
      {
        status: 403,
        statusText: "Forbidden",
        headers: new AxiosHeaders(),
        config: { headers: new AxiosHeaders() },
        data: {
          statusCode: 403,
          code: "FORBIDDEN",
          message: "You are not an active staff member",
        },
      }
    );

    const normalized = normalizeApiError(axiosErr);
    expect(normalized).toBeInstanceOf(ApiClientError);
    expect(normalized.statusCode).toBe(403);
    expect(normalized.code).toBe("FORBIDDEN");
    expect(normalized.message).toBe("You are not an active staff member");
  });

  it("enforces CSRF header and same-origin host checks for BFF auth routes", () => {
    const missingCsrf = new Request("http://localhost:3001/api/auth/login", {
      method: "POST",
      headers: { host: "localhost:3001", origin: "http://localhost:3001" },
    });
    expect(validateSameOriginAndCsrf(missingCsrf).ok).toBe(false);

    const crossOrigin = new Request("http://localhost:3001/api/auth/login", {
      method: "POST",
      headers: {
        host: "localhost:3001",
        origin: "https://evil.example.com",
        "x-chovia-csrf": "1",
      },
    });
    expect(validateSameOriginAndCsrf(crossOrigin).ok).toBe(false);

    const validSameOrigin = new Request("http://localhost:3001/api/auth/login", {
      method: "POST",
      headers: {
        host: "localhost:3001",
        origin: "http://localhost:3001",
        "x-chovia-csrf": "1",
      },
    });
    expect(validateSameOriginAndCsrf(validSameOrigin).ok).toBe(true);
  });

  it("builds HttpOnly SameSite=Lax cookies and parses cookie values safely", () => {
    const cookie = buildRefreshCookieHeader("chovia_admin_rt", "tok_123", {
      maxAgeSeconds: 3600,
      isProduction: true,
    });
    expect(cookie).toContain("chovia_admin_rt=tok_123");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Secure");
    expect(parseCookieValue("foo=bar; chovia_admin_rt=tok_123", "chovia_admin_rt")).toBe("tok_123");
  });
});

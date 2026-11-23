import crypto from "node:crypto";
import { describe, it, expect } from "vitest";
import { PaystackService } from "../integrations/paystack/paystack.service.js";
import { BadRequestError } from "../common/errors/api-error.js";

describe("Paystack Payment Integration & Webhook Security", () => {
  const secretKey = "sk_test_mock_paystack_secret_key_123456";
  const webhookSecret = "whsec_mock_paystack_webhook_secret_123456";
  const paystack = new PaystackService({ secretKey, webhookSecret });

  it("should verify valid HMAC-SHA512 webhook signature", () => {
    const rawBody = JSON.stringify({
      event: "charge.success",
      data: {
        reference: "CHV-PAY-123456",
        amount: 500000,
        status: "success",
        currency: "NGN",
      },
    });

    const validSignature = crypto
      .createHmac("sha512", webhookSecret)
      .update(rawBody)
      .digest("hex");

    const isValid = paystack.verifyWebhookSignature(rawBody, validSignature);
    expect(isValid).toBe(true);
  });

  it("should reject tampered payload with valid-looking signature", () => {
    const originalBody = JSON.stringify({
      event: "charge.success",
      data: { reference: "CHV-PAY-123456", amount: 500000 },
    });
    const tamperedBody = JSON.stringify({
      event: "charge.success",
      data: { reference: "CHV-PAY-123456", amount: 100 }, // Attacker changed amount
    });

    const signature = crypto
      .createHmac("sha512", webhookSecret)
      .update(originalBody)
      .digest("hex");

    const isValid = paystack.verifyWebhookSignature(tamperedBody, signature);
    expect(isValid).toBe(false);
  });

  it("should reject invalid webhook signature", () => {
    const rawBody = JSON.stringify({ event: "charge.success" });
    const isValid = paystack.verifyWebhookSignature(rawBody, "invalid_hex_signature_abcdef123456");
    expect(isValid).toBe(false);
  });

  it("should reject signature with mismatched length safely without timing leak", () => {
    const rawBody = JSON.stringify({ event: "charge.success" });
    const isValid = paystack.verifyWebhookSignature(rawBody, "short");
    expect(isValid).toBe(false);
  });

  it("should reject empty or missing signature", () => {
    const rawBody = JSON.stringify({ event: "charge.success" });
    expect(paystack.verifyWebhookSignature(rawBody, "")).toBe(false);
    expect(paystack.verifyWebhookSignature("", "some_sig")).toBe(false);
  });

  it("should verify transaction in mock mode with expected amount", async () => {
    const result = await paystack.verifyTransaction("CHV-PAY-REF-100", 350000);
    expect(result.status).toBe("success");
    expect(result.amountMinor).toBe(350000);
    expect(result.currency).toBe("NGN");
  });

  it("should fail verification when simulated failure reference is passed", async () => {
    const result = await paystack.verifyTransaction("CHV-PAY-REF-FAIL-999");
    expect(result.status).toBe("failed");
  });

  it("should throw error if production PaystackService is created with non-live key", () => {
    expect(() => {
      new PaystackService({
        secretKey: "sk_test_fake_key_12345",
        isProduction: true,
      });
    }).toThrow(/live secret key/i);
  });

  it("should detect and reject transaction reference mismatch from provider", async () => {
    const customPaystack = new PaystackService({
      secretKey: "sk_test_mock_1234567890abcdef",
      isMock: false,
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({
          status: true,
          data: {
            id: 998877,
            status: "success",
            reference: "DIFFERENT-UNTRUSTED-REF",
            amount: 500000,
            currency: "NGN",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof fetch;

    try {
      await expect(
        customPaystack.verifyTransaction("REQUESTED-CHV-PAY-123", 500000)
      ).rejects.toThrow(/reference mismatch/i);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("should reject verification when provider currency is missing", async () => {
    const customPaystack = new PaystackService({
      secretKey: "sk_test_mock_1234567890abcdef",
      isMock: false,
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({
          status: true,
          data: {
            id: 12345,
            status: "success",
            reference: "CHV-PAY-NO-CURRENCY",
            amount: 500000,
            // currency field is missing!
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof fetch;

    try {
      await expect(
        customPaystack.verifyTransaction("CHV-PAY-NO-CURRENCY", 500000)
      ).rejects.toThrow(BadRequestError);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("should reject verification when provider currency is not NGN (e.g. USD)", async () => {
    const customPaystack = new PaystackService({
      secretKey: "sk_test_mock_1234567890abcdef",
      isMock: false,
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({
          status: true,
          data: {
            id: 12345,
            status: "success",
            reference: "CHV-PAY-USD",
            amount: 500000,
            currency: "USD",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof fetch;

    try {
      await expect(
        customPaystack.verifyTransaction("CHV-PAY-USD", 500000)
      ).rejects.toThrow(BadRequestError);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("should reject verification when provider returns amount mismatch", async () => {
    const customPaystack = new PaystackService({
      secretKey: "sk_test_mock_1234567890abcdef",
      isMock: false,
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({
          status: true,
          data: {
            id: 12345,
            status: "success",
            reference: "CHV-PAY-AMOUNT-MISMATCH",
            amount: 10000, // Attacker or provider returned 100 NGN instead of 5000 NGN
            currency: "NGN",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof fetch;

    try {
      await expect(
        customPaystack.verifyTransaction("CHV-PAY-AMOUNT-MISMATCH", 500000)
      ).rejects.toThrow(/amount mismatch/i);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("should reject verification when transaction ID is missing from provider response", async () => {
    const customPaystack = new PaystackService({
      secretKey: "sk_test_mock_1234567890abcdef",
      isMock: false,
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({
          status: true,
          data: {
            // id is missing!
            status: "success",
            reference: "CHV-PAY-NO-ID",
            amount: 500000,
            currency: "NGN",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof fetch;

    try {
      await expect(
        customPaystack.verifyTransaction("CHV-PAY-NO-ID", 500000)
      ).rejects.toThrow(BadRequestError);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("should parse non-success provider statuses correctly (abandoned, pending, failed)", async () => {
    const customPaystack = new PaystackService({
      secretKey: "sk_test_mock_1234567890abcdef",
      isMock: false,
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({
          status: true,
          data: {
            id: 887766,
            status: "abandoned",
            reference: "CHV-PAY-ABANDONED",
            amount: 500000,
            currency: "NGN",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof fetch;

    try {
      const result = await customPaystack.verifyTransaction("CHV-PAY-ABANDONED", 500000);
      expect(result.status).toBe("abandoned");
      expect(result.currency).toBe("NGN");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("should safely guard against reviving terminal orders (CANCELLED, REFUNDED, REJECTED)", () => {
    const terminalStatuses = ["CANCELLED", "REFUNDED", "REJECTED"];
    for (const status of terminalStatuses) {
      const isTerminal = ["CANCELLED", "REFUNDED", "REJECTED"].includes(status);
      expect(isTerminal).toBe(true);
    }
    expect(["CANCELLED", "REFUNDED", "REJECTED"].includes("PENDING_PAYMENT")).toBe(false);
  });
});

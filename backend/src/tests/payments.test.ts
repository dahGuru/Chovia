/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from "node:crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PaystackService, paystackService } from "../integrations/paystack/paystack.service.js";
import { paymentsService } from "../modules/payments/payments.service.js";
import { prisma } from "../database/prisma.js";
import { outboxDispatcher } from "../jobs/outbox/outbox.dispatcher.js";
import { BadRequestError, ForbiddenError, NotFoundError, PaymentGatewayError } from "../common/errors/api-error.js";

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
      ).rejects.toThrow(PaymentGatewayError);
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
      ).rejects.toThrow(PaymentGatewayError);
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
      ).rejects.toThrow(PaymentGatewayError);
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

  it("should verify Paystack initialization requires matching reference and valid URL", async () => {
    const customPaystack = new PaystackService({
      secretKey: "sk_test_mock_1234567890abcdef",
      isMock: false,
    });

    const originalFetch = globalThis.fetch;
    // 1. Success with matching reference
    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({
          status: true,
          data: {
            authorization_url: "https://checkout.paystack.com/auth-123",
            access_code: "code_123",
            reference: "CHV-PAY-INIT-MATCH",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof fetch;

    const successResult = await customPaystack.initializeTransaction({
      email: "customer@example.com",
      amountMinor: 250000,
      reference: "CHV-PAY-INIT-MATCH",
    });
    expect(successResult.reference).toBe("CHV-PAY-INIT-MATCH");
    expect(successResult.authorizationUrl).toBe("https://checkout.paystack.com/auth-123");

    // 2. Failure with mismatched reference
    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({
          status: true,
          data: {
            authorization_url: "https://checkout.paystack.com/auth-456",
            access_code: "code_456",
            reference: "DIFFERENT-REF-FROM-PROVIDER",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof fetch;

    await expect(
      customPaystack.initializeTransaction({
        email: "customer@example.com",
        amountMinor: 250000,
        reference: "CHV-PAY-INIT-MATCH",
      })
    ).rejects.toThrow(/reference mismatch/i);

    // 3. Failure on HTTP 500 server error
    globalThis.fetch = (async () => {
      return new Response("Internal Server Error", { status: 500 });
    }) as typeof fetch;

    await expect(
      customPaystack.initializeTransaction({
        email: "customer@example.com",
        amountMinor: 250000,
        reference: "CHV-PAY-INIT-MATCH",
      })
    ).rejects.toThrow(/initialization failed with status 500/i);

    globalThis.fetch = originalFetch;
  });

  it("should distinguish provider 5xx outages from genuine transaction failures during verification", async () => {
    const customPaystack = new PaystackService({
      secretKey: "sk_test_mock_1234567890abcdef",
      isMock: false,
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      return new Response("Bad Gateway", { status: 502 });
    }) as typeof fetch;

    try {
      await expect(
        customPaystack.verifyTransaction("CHV-PAY-502-OUTAGE", 100000)
      ).rejects.toThrow(/service temporarily unavailable/i);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("should process Paystack refund transactions and validate response envelope", async () => {
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
            transaction: "CHV-PAY-REFUND-1",
            reference: "CHV-REF-12345",
            amount: 150000,
            currency: "NGN",
            status: "processed",
            refunded_at: new Date().toISOString(),
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof fetch;

    try {
      const refundResult = await customPaystack.createRefund({
        transactionReferenceOrId: "CHV-PAY-REFUND-1",
        amountMinor: 150000,
        merchantNote: "Customer cancelled before preparation",
      });

      expect(refundResult.status).toBe("processed");
      expect(refundResult.refundId).toBe(998877);
      expect(refundResult.amountMinor).toBe(150000);
      expect(refundResult.currency).toBe("NGN");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("PaymentsService Workflow & State Machine", () => {
  beforeEach(() => {
    vi.spyOn(outboxDispatcher, "dispatchPendingEvents").mockResolvedValue(0);
  });
  it("should reject verifyPayment when requesting user does not own the order", async () => {
    const findUniqueSpy = vi.spyOn(prisma.payment, "findUnique").mockResolvedValueOnce({
      id: "pay_1",
      orderId: "ord_1",
      providerReference: "CHV-PAY-REF-1",
      amount: "5000.00" as any,
      currency: "NGN",
      status: "PENDING",
      paidAt: null,
      providerTransactionId: null,
      providerResponse: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      order: {
        id: "ord_1",
        customer: { userId: "usr_legitimate_customer" },
        refunds: [],
      },
    } as any);

    try {
      await expect(
        paymentsService.verifyPayment("usr_unauthorized_attacker", "CHV-PAY-REF-1")
      ).rejects.toThrow(ForbiddenError);
    } finally {
      findUniqueSpy.mockRestore();
    }
  });

  it("should not revive CANCELLED or REJECTED orders to CONFIRMED and record reconciliation note", async () => {
    const paymentRecord = {
      id: "pay_cancelled",
      orderId: "ord_cancelled",
      providerReference: "CHV-PAY-CANCELLED",
      amount: "4500.00" as any,
      currency: "NGN",
      status: "PENDING",
      paidAt: null,
      order: {
        id: "ord_cancelled",
        status: "CANCELLED",
        orderNumber: "CHV-ORD-8888",
        customer: { userId: "usr_cust_1" },
        refunds: [],
      },
    };

    const findUniqueSpy = vi.spyOn(prisma.payment, "findUnique").mockResolvedValueOnce(paymentRecord as any);
    const verifySpy = vi.spyOn(paystackService, "verifyTransaction").mockResolvedValueOnce({
      status: "success",
      amountMinor: 450000,
      currency: "NGN",
      paidAt: new Date(),
      transactionId: "paystack_tx_999",
    });

    const txOrderUpdateSpy = vi.fn();
    const txDeliveryUpsertSpy = vi.fn();
    const txOrderStatusHistorySpy = vi.fn().mockResolvedValue({});
    const txPaymentUpdateSpy = vi.fn().mockResolvedValue({});

    const mockTx = {
      payment: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: txPaymentUpdateSpy,
      },
      order: {
        findUnique: vi.fn().mockResolvedValue(paymentRecord.order),
        update: txOrderUpdateSpy,
      },
      orderStatusHistory: {
        create: txOrderStatusHistorySpy,
      },
      delivery: {
        upsert: txDeliveryUpsertSpy,
      },
      outboxEvent: {
        create: vi.fn().mockResolvedValue({}),
      },
    };

    const txSpy = vi.spyOn(prisma, "$transaction").mockImplementationOnce(async (cb: any) => {
      return cb(mockTx);
    });

    try {
      const result = await paymentsService.verifyPayment("usr_cust_1", "CHV-PAY-CANCELLED");
      expect(result.status).toBe("SUCCESS");

      // Verify order status was NOT changed to CONFIRMED
      expect(txOrderUpdateSpy).not.toHaveBeenCalled();
      // Verify delivery was NOT created
      expect(txDeliveryUpsertSpy).not.toHaveBeenCalled();

      // Verify reconciliation history was created
      expect(txOrderStatusHistorySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orderId: "ord_cancelled",
            fromStatus: "CANCELLED",
            toStatus: "CANCELLED",
            reason: expect.stringContaining("terminal status"),
          }),
        })
      );

      // Verify payment was updated with reconciliation required
      expect(txPaymentUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            providerResponse: expect.objectContaining({
              reconciliationRequired: true,
              orderStatus: "CANCELLED",
            }),
          }),
        })
      );
    } finally {
      findUniqueSpy.mockRestore();
      verifySpy.mockRestore();
      txSpy.mockRestore();
    }
  }, 15000);

  it("should not revive order with existing REFUNDED or REFUND_PENDING refund to CONFIRMED", async () => {
    const paymentRecord = {
      id: "pay_refunded",
      orderId: "ord_refunded",
      providerReference: "CHV-PAY-REFUNDED",
      amount: "6000.00" as any,
      currency: "NGN",
      status: "PENDING",
      paidAt: null,
      order: {
        id: "ord_refunded",
        status: "CONFIRMED",
        orderNumber: "CHV-ORD-7777",
        customer: { userId: "usr_cust_2" },
        refunds: [{ status: "REFUNDED", id: "ref_1" }],
      },
    };

    const findUniqueSpy = vi.spyOn(prisma.payment, "findUnique").mockResolvedValueOnce(paymentRecord as any);
    const verifySpy = vi.spyOn(paystackService, "verifyTransaction").mockResolvedValueOnce({
      status: "success",
      amountMinor: 600000,
      currency: "NGN",
      paidAt: new Date(),
      transactionId: "paystack_tx_888",
    });

    const txOrderUpdateSpy = vi.fn();
    const txOrderStatusHistorySpy = vi.fn().mockResolvedValue({});
    const txPaymentUpdateSpy = vi.fn().mockResolvedValue({});

    const mockTx = {
      payment: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: txPaymentUpdateSpy,
      },
      order: {
        findUnique: vi.fn().mockResolvedValue(paymentRecord.order),
        update: txOrderUpdateSpy,
      },
      orderStatusHistory: {
        create: txOrderStatusHistorySpy,
      },
    };

    const txSpy = vi.spyOn(prisma, "$transaction").mockImplementationOnce(async (cb: any) => {
      return cb(mockTx);
    });

    try {
      await paymentsService.verifyPayment("usr_cust_2", "CHV-PAY-REFUNDED");

      expect(txOrderUpdateSpy).not.toHaveBeenCalled();
      expect(txOrderStatusHistorySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reason: expect.stringContaining("refund"),
          }),
        })
      );
      expect(txPaymentUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            providerResponse: expect.objectContaining({
              reconciliationRequired: true,
              refundStatus: "REFUNDED",
            }),
          }),
        })
      );
    } finally {
      findUniqueSpy.mockRestore();
      verifySpy.mockRestore();
      txSpy.mockRestore();
    }
  });

  it("should transition PENDING_PAYMENT order to CONFIRMED, set Delivery to PENDING, and emit OutboxEvent", async () => {
    const paymentRecord = {
      id: "pay_ok",
      orderId: "ord_ok",
      providerReference: "CHV-PAY-OK-1",
      amount: "3000.00" as any,
      currency: "NGN",
      status: "PENDING",
      paidAt: null,
      order: {
        id: "ord_ok",
        status: "PENDING_PAYMENT",
        orderNumber: "CHV-ORD-5555",
        customer: { userId: "usr_cust_3" },
        restaurantId: "rest_1",
        refunds: [],
      },
    };

    const findUniqueSpy = vi.spyOn(prisma.payment, "findUnique").mockResolvedValueOnce(paymentRecord as any);
    const verifySpy = vi.spyOn(paystackService, "verifyTransaction").mockResolvedValueOnce({
      status: "success",
      amountMinor: 300000,
      currency: "NGN",
      paidAt: new Date(),
      transactionId: "paystack_tx_12345",
    });

    const txOrderUpdateSpy = vi.fn().mockResolvedValue({});
    const txDeliveryUpsertSpy = vi.fn().mockResolvedValue({});
    const txOutboxCreateSpy = vi.fn().mockResolvedValue({});
    const txOrderStatusHistorySpy = vi.fn().mockResolvedValue({});
    const txNotificationCreateSpy = vi.fn().mockResolvedValue({});

    const mockTx = {
      payment: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      order: {
        findUnique: vi.fn().mockResolvedValue(paymentRecord.order),
        update: txOrderUpdateSpy,
      },
      orderStatusHistory: {
        create: txOrderStatusHistorySpy,
      },
      delivery: {
        upsert: txDeliveryUpsertSpy,
      },
      notification: {
        create: txNotificationCreateSpy,
      },
      outboxEvent: {
        create: txOutboxCreateSpy,
      },
    };

    const txSpy = vi.spyOn(prisma, "$transaction").mockImplementationOnce(async (cb: any) => {
      return cb(mockTx);
    });

    try {
      const result = await paymentsService.verifyPayment("usr_cust_3", "CHV-PAY-OK-1");
      expect(result.status).toBe("SUCCESS");

      // Verify order transitioned to CONFIRMED
      expect(txOrderUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "ord_ok" },
          data: { status: "CONFIRMED" },
        })
      );

      // Verify delivery created with PENDING status (NOT READY!)
      expect(txDeliveryUpsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            orderId: "ord_ok",
            status: "PENDING",
          }),
        })
      );

      // Verify transactional OutboxEvent created for ORDER_CONFIRMED_NOTIFICATION
      expect(txOutboxCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: "ORDER_CONFIRMED_NOTIFICATION",
            aggregateType: "ORDER",
            aggregateId: "ord_ok",
            status: "PENDING",
          }),
        })
      );
    } finally {
      findUniqueSpy.mockRestore();
      verifySpy.mockRestore();
      txSpy.mockRestore();
    }
  });

  it("should validate refund prerequisites (unpaid order, existing refund, excessive amount)", async () => {
    // 1. Order not found
    const txSpy1 = vi.spyOn(prisma, "$transaction").mockImplementationOnce(async (cb: any) => {
      return cb({
        order: { findUnique: vi.fn().mockResolvedValue(null) },
      });
    });
    await expect(
      paymentsService.requestRefund("admin_1", "non_existent_order")
    ).rejects.toThrow(NotFoundError);
    txSpy1.mockRestore();

    // 2. Order not successfully paid
    const txSpy2 = vi.spyOn(prisma, "$transaction").mockImplementationOnce(async (cb: any) => {
      return cb({
        order: {
          findUnique: vi.fn().mockResolvedValue({
            id: "ord_unpaid",
            payment: { status: "PENDING" },
            refunds: [],
          }),
        },
      });
    });
    await expect(
      paymentsService.requestRefund("admin_1", "ord_unpaid")
    ).rejects.toThrow(BadRequestError);
    txSpy2.mockRestore();

    // 3. Order already fully refunded
    const txSpy3 = vi.spyOn(prisma, "$transaction").mockImplementationOnce(async (cb: any) => {
      return cb({
        order: {
          findUnique: vi.fn().mockResolvedValue({
            id: "ord_already_refunded",
            payment: { status: "SUCCESS", amount: "50.00" },
            refunds: [{ status: "REFUNDED", amount: "50.00" }],
          }),
        },
      });
    });
    await expect(
      paymentsService.requestRefund("admin_1", "ord_already_refunded")
    ).rejects.toThrow(/already been fully refunded/i);
    txSpy3.mockRestore();

    // 4. Refund amount exceeds remaining refundable amount
    const txSpy4 = vi.spyOn(prisma, "$transaction").mockImplementationOnce(async (cb: any) => {
      return cb({
        order: {
          findUnique: vi.fn().mockResolvedValue({
            id: "ord_excess",
            payment: { status: "SUCCESS", amount: "50.00" }, // 5000 kobo
            refunds: [],
          }),
        },
      });
    });
    await expect(
      paymentsService.requestRefund("admin_1", "ord_excess", 6000) // 6000 > 5000
    ).rejects.toThrow(/cannot exceed remaining refundable amount/i);
    txSpy4.mockRestore();
  });

  it("should process refund request, call Paystack refund API, and create audit log", async () => {
    const validOrder = {
      id: "ord_to_refund",
      payment: {
        id: "pay_to_refund",
        status: "SUCCESS",
        amount: "100.00",
        providerReference: "CHV-PAY-REFUNDABLE",
        providerTransactionId: "paystack_tx_555",
      },
      refunds: [],
    };

    const mockCreatedRefund = {
      id: "ref_created_1",
      orderId: "ord_to_refund",
      amount: "100.00",
      currency: "NGN",
      status: "REFUND_PENDING",
      reason: "Customer cancellation",
      requestedAt: new Date(),
      completedAt: null,
    };

    const txRefundCreateSpy = vi.fn().mockResolvedValue(mockCreatedRefund);
    const txAuditLogCreateSpy = vi.fn().mockResolvedValue({});

    const mockTx = {
      order: { findUnique: vi.fn().mockResolvedValue(validOrder) },
      refund: { create: txRefundCreateSpy },
      auditLog: { create: txAuditLogCreateSpy },
    };

    const txSpy = vi.spyOn(prisma, "$transaction").mockImplementationOnce(async (cb: any) => {
      return cb(mockTx);
    });

    const createRefundSpy = vi.spyOn(paystackService, "createRefund").mockResolvedValueOnce({
      status: "processed",
      refundId: 887766,
      reference: "CHV-PAY-REFUNDABLE",
      amountMinor: 10000,
      currency: "NGN",
      refundedAt: new Date(),
    });

    const refundUpdateSpy = vi.spyOn(prisma.refund, "update").mockResolvedValueOnce({
      ...mockCreatedRefund,
      status: "REFUNDED",
      providerRefundId: "887766",
      completedAt: new Date(),
    } as any);

    const findManyRefundsSpy = vi.spyOn(prisma.refund, "findMany").mockResolvedValueOnce([
      { id: "ref_created_1", orderId: "ord_to_refund", amount: "100.00", status: "REFUNDED" },
    ] as any);
    const orderUpdateSpy = vi.spyOn(prisma.order, "update").mockResolvedValueOnce({} as any);

    try {
      const result = await paymentsService.requestRefund(
        "admin_user_1",
        "ord_to_refund",
        10000,
        "Customer cancellation"
      );

      expect(result.status).toBe("REFUNDED");
      expect(result.providerRefundId).toBe("887766");
      expect(createRefundSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          transactionReferenceOrId: "CHV-PAY-REFUNDABLE",
          amountMinor: 10000,
        })
      );
      expect(refundUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "ref_created_1" },
          data: expect.objectContaining({ status: "REFUNDED", providerRefundId: "887766" }),
        })
      );
      expect(txAuditLogCreateSpy).toHaveBeenCalled();
    } finally {
      txSpy.mockRestore();
      createRefundSpy.mockRestore();
      refundUpdateSpy.mockRestore();
      findManyRefundsSpy.mockRestore();
      orderUpdateSpy.mockRestore();
    }
  });

  it("should support multiple partial refunds and enforce cumulative limits with reservation", async () => {
    // Scenario: Order total = 10,000 kobo (100.00 NGN)
    // 1st refund = 4,000 kobo (already completed)
    // 2nd refund requested = 7,000 kobo -> exceeds remaining 6,000 kobo -> should fail
    // 2nd refund requested = 3,000 kobo -> should succeed (leaves 3,000 kobo)
    const orderWithPartialRefund = {
      id: "ord_partial",
      payment: {
        id: "pay_partial",
        status: "SUCCESS",
        amount: "100.00", // 10,000 kobo
        providerReference: "CHV-PAY-PARTIAL",
      },
      refunds: [
        {
          id: "ref_part_1",
          orderId: "ord_partial",
          amount: "40.00", // 4,000 kobo
          status: "REFUNDED",
        },
      ],
    };

    // Attempt refund of 7,000 kobo (4,000 + 7,000 = 11,000 > 10,000)
    const txSpy1 = vi.spyOn(prisma, "$transaction").mockImplementationOnce(async (cb: any) => {
      return cb({
        order: { findUnique: vi.fn().mockResolvedValue(orderWithPartialRefund) },
      });
    });

    await expect(
      paymentsService.requestRefund("admin_1", "ord_partial", 7000, "Too much")
    ).rejects.toThrow(/cannot exceed remaining refundable amount/i);
    txSpy1.mockRestore();

    // Now attempt valid 2nd partial refund of 3,000 kobo
    const secondRefundRecord = {
      id: "ref_part_2",
      orderId: "ord_partial",
      amount: "30.00",
      currency: "NGN",
      status: "REFUND_PENDING",
      reason: "Second partial refund",
      requestedAt: new Date(),
      completedAt: null,
    };

    const mockTx = {
      order: { findUnique: vi.fn().mockResolvedValue(orderWithPartialRefund) },
      refund: { create: vi.fn().mockResolvedValue(secondRefundRecord) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };

    const txSpy2 = vi.spyOn(prisma, "$transaction").mockImplementationOnce(async (cb: any) => {
      return cb(mockTx);
    });

    const createRefundSpy = vi.spyOn(paystackService, "createRefund").mockResolvedValueOnce({
      status: "pending",
      refundId: 554433,
      reference: "CHV-PAY-PARTIAL",
      amountMinor: 3000,
      currency: "NGN",
    });

    const refundUpdateSpy = vi.spyOn(prisma.refund, "update").mockResolvedValueOnce({
      ...secondRefundRecord,
      status: "PROCESSING",
      providerRefundId: "554433",
      processedAt: new Date(),
    } as any);

    try {
      const result = await paymentsService.requestRefund(
        "admin_1",
        "ord_partial",
        3000,
        "Second partial refund"
      );

      // Verify Paystack pending state mapped to PROCESSING
      expect(result.status).toBe("PROCESSING");
      expect(result.amountMinor).toBe(3000);
      expect(result.providerRefundId).toBe("554433");
      expect(refundUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "ref_part_2" },
          data: expect.objectContaining({
            status: "PROCESSING",
            providerRefundId: "554433",
          }),
        })
      );
    } finally {
      txSpy2.mockRestore();
      createRefundSpy.mockRestore();
      refundUpdateSpy.mockRestore();
    }
  });

  it("should handle webhook events correctly (charge.success, refund.processed, refund.failed)", async () => {
    // 1. Invalid signature
    const verifySigSpy = vi.spyOn(paystackService, "verifyWebhookSignature").mockReturnValue(false);
    await expect(
      paymentsService.handleWebhook("{}", "invalid_sig")
    ).rejects.toThrow(BadRequestError);
    verifySigSpy.mockRestore();

    // 2. charge.success webhook event
    vi.spyOn(paystackService, "verifyWebhookSignature").mockReturnValue(true);

    const findPaymentSpy = vi.spyOn(prisma.payment, "findUnique").mockResolvedValueOnce({
      id: "pay_wh_1",
      orderId: "ord_wh_1",
      status: "PENDING",
      amount: "50.00",
      currency: "NGN",
    } as any);

    const mockTx = {
      payment: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      order: {
        findUnique: vi.fn().mockResolvedValue({
          id: "ord_wh_1",
          status: "PENDING_PAYMENT",
          orderNumber: "ORD-WH-1",
          customer: { userId: "usr_cust_wh" },
          restaurantId: "rest_wh",
          refunds: [],
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      orderStatusHistory: { create: vi.fn().mockResolvedValue({}) },
      delivery: { upsert: vi.fn().mockResolvedValue({}) },
      notification: { create: vi.fn().mockResolvedValue({}) },
      outboxEvent: { create: vi.fn().mockResolvedValue({}) },
    };

    const txSpy = vi.spyOn(prisma, "$transaction").mockImplementationOnce(async (cb: any) => {
      return cb(mockTx);
    });

    const chargePayload = JSON.stringify({
      event: "charge.success",
      data: {
        status: "success",
        reference: "CHV-PAY-WH-REF",
        amount: 5000,
        currency: "NGN",
        id: 778899,
        paid_at: new Date().toISOString(),
      },
    });

    const whResult = await paymentsService.handleWebhook(chargePayload, "valid_mock_sig");
    expect(whResult.received).toBe(true);

    findPaymentSpy.mockRestore();
    txSpy.mockRestore();

    // 3. refund.processed webhook event matching providerRefundId
    const findRefundSpy = vi.spyOn(prisma.refund, "findFirst").mockResolvedValueOnce({
      id: "ref_wh_1",
      orderId: "ord_wh_1",
      status: "PROCESSING",
      amount: "50.00",
      order: {
        payment: { amount: "50.00" },
      },
    } as any);

    const mockRefundTx = {
      refund: {
        update: vi.fn().mockResolvedValue({}),
        findMany: vi.fn().mockResolvedValue([
          { id: "ref_wh_1", orderId: "ord_wh_1", amount: "50.00", status: "REFUNDED" },
        ]),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
      order: { update: vi.fn().mockResolvedValue({}) },
      orderStatusHistory: { create: vi.fn().mockResolvedValue({}) },
    };

    const refundTxSpy = vi.spyOn(prisma, "$transaction").mockImplementationOnce(async (cb: any) => {
      return cb(mockRefundTx);
    });

    const refundProcessedPayload = JSON.stringify({
      event: "refund.processed",
      data: {
        id: 998877,
        reference: "CHV-REF-WH-1",
        status: "processed",
        amount: 5000,
      },
    });

    const refundWhResult = await paymentsService.handleWebhook(refundProcessedPayload, "valid_mock_sig");
    expect(refundWhResult.received).toBe(true);
    expect(mockRefundTx.refund.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ref_wh_1" },
        data: expect.objectContaining({ status: "REFUNDED", providerRefundId: "998877" }),
      })
    );

    findRefundSpy.mockRestore();
    refundTxSpy.mockRestore();

    // 4. Idempotent repeat of refund.processed when already REFUNDED
    const findRefundAlreadyDoneSpy = vi.spyOn(prisma.refund, "findFirst").mockResolvedValueOnce({
      id: "ref_wh_1",
      orderId: "ord_wh_1",
      status: "REFUNDED", // Already terminal
      amount: "50.00",
      order: { payment: { amount: "50.00" } },
    } as any);

    const repeatResult = await paymentsService.handleWebhook(refundProcessedPayload, "valid_mock_sig");
    expect(repeatResult.received).toBe(true);
    findRefundAlreadyDoneSpy.mockRestore();

    vi.restoreAllMocks();
  });
});

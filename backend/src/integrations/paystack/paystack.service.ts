import crypto from "node:crypto";
import { z } from "zod";
import { env } from "../../config/env.js";
import { BadRequestError, PaymentGatewayError } from "../../common/errors/api-error.js";

export const paystackTransactionDataSchema = z.object({
  id: z.union([z.number(), z.string()]),
  status: z.string().min(1),
  reference: z.string().min(1),
  amount: z.number().int().positive(),
  currency: z.literal("NGN"),
  paid_at: z.string().nullable().optional(),
  channel: z.string().nullable().optional(),
  gateway_response: z.string().nullable().optional(),
});

export const paystackVerifyApiResponseSchema = z.object({
  status: z.boolean(),
  message: z.string().optional(),
  data: paystackTransactionDataSchema.nullable().optional(),
});

export const paystackInitApiResponseSchema = z.object({
  status: z.boolean(),
  message: z.string().optional(),
  data: z
    .object({
      authorization_url: z.string().url(),
      access_code: z.string().min(1),
      reference: z.string().min(1),
    })
    .nullable()
    .optional(),
});

export const paystackRefundApiResponseSchema = z.object({
  status: z.boolean(),
  message: z.string().optional(),
  data: z
    .object({
      id: z.union([z.number(), z.string()]),
      transaction: z.union([z.number(), z.string(), z.record(z.string(), z.unknown())]).optional(),
      reference: z.string().optional(),
      amount: z.number().int().positive(),
      currency: z.literal("NGN"),
      status: z.string().min(1),
      refunded_at: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});

export interface InitializePaymentParams {
  email: string;
  amountMinor: number;
  reference: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface InitializePaymentResult {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

export interface VerifyPaymentResult {
  status: "success" | "failed" | "abandoned" | "pending";
  reference: string;
  amountMinor: number;
  currency: string;
  transactionId?: string | number;
  paidAt?: Date;
  channel?: string;
  rawResponse?: unknown;
}

export interface CreateRefundParams {
  transactionReferenceOrId: string;
  amountMinor?: number | undefined;
  merchantNote?: string | undefined;
}

export interface CreateRefundResult {
  status: "processed" | "pending" | "failed";
  refundId: string | number;
  reference: string;
  amountMinor: number;
  currency: string;
  refundedAt?: Date | undefined;
  rawResponse?: unknown;
}

export class PaystackService {
  private secretKey: string;
  private webhookSecret: string;
  private isMock: boolean;

  constructor(options?: {
    secretKey?: string;
    webhookSecret?: string;
    isMock?: boolean;
    isProduction?: boolean;
  }) {
    this.secretKey = options?.secretKey || env.PAYSTACK_SECRET_KEY || "";
    this.webhookSecret =
      options?.webhookSecret ||
      env.PAYSTACK_WEBHOOK_SECRET ||
      this.secretKey ||
      (env.NODE_ENV !== "production" && env.NODE_ENV !== "staging" ? "chovia_dev_webhook_secret_fallback" : "");

    const isProd =
      options?.isProduction ??
      (env.NODE_ENV === "production" || process.env["NODE_ENV"] === "production");

    if (isProd) {
      if (!/^sk_live_[a-zA-Z0-9]+$/.test(this.secretKey)) {
        throw new Error("PaystackService: Valid live secret key (sk_live_...) is required in production.");
      }
      this.isMock = false;
    } else {
      this.isMock =
        options?.isMock !== undefined
          ? options.isMock
          : Boolean(env.MOCK_INTEGRATIONS || this.secretKey.startsWith("sk_test_mock"));
    }
  }

  async initializeTransaction(
    params: InitializePaymentParams
  ): Promise<InitializePaymentResult> {
    if (!params.reference || params.reference.trim().length === 0) {
      throw new BadRequestError("Payment reference is required for initialization");
    }

    if (this.isMock) {
      if (env.NODE_ENV === "production") {
        throw new Error("Mock payment provider is strictly forbidden in production.");
      }
      return {
        authorizationUrl: `https://checkout.paystack.com/mock-checkout-${params.reference}`,
        accessCode: `mock_code_${params.reference}`,
        reference: params.reference,
      };
    }

    let response: Response;
    try {
      response = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: params.email,
          amount: params.amountMinor,
          reference: params.reference,
          callback_url: params.callbackUrl,
          metadata: params.metadata,
        }),
      });
    } catch (error) {
      throw new PaymentGatewayError("Paystack transaction initialization network failure", error);
    }

    if (!response.ok) {
      throw new PaymentGatewayError(
        `Paystack transaction initialization failed with status ${response.status}`
      );
    }

    let rawJson: unknown;
    try {
      rawJson = await response.json();
    } catch (error) {
      throw new PaymentGatewayError("Invalid JSON from Paystack initialization response", error);
    }

    const parseResult = paystackInitApiResponseSchema.safeParse(rawJson);

    if (!parseResult.success) {
      throw new BadRequestError(
        `Paystack initialization response invalid: ${parseResult.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")}`
      );
    }

    const data = parseResult.data;
    if (!data.status || !data.data) {
      throw new BadRequestError(`Paystack transaction initialization failed: ${data.message || "Unknown error"}`);
    }

    if (!data.data.authorization_url || data.data.authorization_url.trim().length === 0) {
      throw new BadRequestError("Paystack initialization did not return an authorization URL");
    }

    // Strict reference match: Paystack must echo back the exact reference supplied by CHOVIA
    if (data.data.reference !== params.reference) {
      throw new BadRequestError(
        `Paystack initialization reference mismatch: requested "${params.reference}" but provider returned "${data.data.reference}"`
      );
    }

    return {
      authorizationUrl: data.data.authorization_url,
      accessCode: data.data.access_code,
      reference: data.data.reference,
    };
  }

  async verifyTransaction(reference: string, expectedAmountMinor?: number): Promise<VerifyPaymentResult> {
    if (!reference || reference.trim().length === 0) {
      throw new BadRequestError("Transaction reference is required for verification");
    }

    if (this.isMock) {
      if (env.NODE_ENV === "production") {
        throw new Error("Mock payment verification is strictly forbidden in production.");
      }
      // In mock mode, only succeed if reference is not flagged as failed
      const isSimulatedFailure = reference.includes("FAIL");
      return {
        status: isSimulatedFailure ? "failed" : "success",
        reference,
        amountMinor: expectedAmountMinor ?? 250000,
        currency: "NGN",
        transactionId: "mock_tx_12345",
        paidAt: new Date(),
        channel: "card",
        rawResponse: { mock: true, status: isSimulatedFailure ? "failed" : "success" },
      };
    }

    let response: Response;
    try {
      response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
        },
      });
    } catch (error) {
      throw new PaymentGatewayError("Paystack verification network failure", error);
    }

    // Distinguish provider server outage (5xx), auth failures (401), or rate limits (429) from transaction outcome
    if (response.status >= 500 || response.status === 401 || response.status === 429) {
      throw new PaymentGatewayError(
        `Paystack verification service temporarily unavailable (HTTP ${response.status})`
      );
    }

    let rawJson: unknown;
    try {
      rawJson = await response.json();
    } catch (error) {
      throw new PaymentGatewayError("Invalid JSON from Paystack verification response", error);
    }

    const parseResult = paystackVerifyApiResponseSchema.safeParse(rawJson);

    if (!parseResult.success) {
      throw new PaymentGatewayError(
        `Paystack verification response validation failed: ${parseResult.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")}`
      );
    }

    const payload = parseResult.data;
    if (!payload.status || !payload.data) {
      return {
        status: "failed",
        reference,
        amountMinor: 0,
        currency: "NGN",
        rawResponse: rawJson,
      };
    }

    const txData = payload.data;

    // Strict reference match
    if (txData.reference !== reference) {
      throw new BadRequestError(
        `Paystack verification reference mismatch: requested ${reference} but provider returned ${txData.reference}`
      );
    }

    // Strict amount match
    if (expectedAmountMinor !== undefined && txData.amount !== expectedAmountMinor) {
      throw new BadRequestError(
        `Paystack verification amount mismatch: expected ${expectedAmountMinor} kobo but received ${txData.amount} kobo`
      );
    }

    const isSuccess = txData.status === "success";
    const status: VerifyPaymentResult["status"] = isSuccess
      ? "success"
      : txData.status === "abandoned"
        ? "abandoned"
        : txData.status === "pending"
          ? "pending"
          : "failed";

    const result: VerifyPaymentResult = {
      status,
      reference: txData.reference,
      amountMinor: txData.amount,
      currency: txData.currency,
      transactionId: txData.id,
      rawResponse: txData,
    };

    if (txData.paid_at) {
      result.paidAt = new Date(txData.paid_at);
    }
    if (txData.channel) {
      result.channel = txData.channel;
    }

    return result;
  }

  async createRefund(params: CreateRefundParams): Promise<CreateRefundResult> {
    if (!params.transactionReferenceOrId) {
      throw new BadRequestError("Transaction reference or ID is required for refund");
    }

    if (this.isMock) {
      if (env.NODE_ENV === "production") {
        throw new Error("Mock refund is strictly forbidden in production.");
      }
      return {
        status: "processed",
        refundId: `mock_ref_${Date.now()}`,
        reference: String(params.transactionReferenceOrId),
        amountMinor: params.amountMinor ?? 100000,
        currency: "NGN",
        refundedAt: new Date(),
        rawResponse: { mock: true, status: "processed" },
      };
    }

    let response: Response;
    try {
      response = await fetch("https://api.paystack.co/refund", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transaction: params.transactionReferenceOrId,
          ...(params.amountMinor ? { amount: params.amountMinor } : {}),
          ...(params.merchantNote ? { merchant_note: params.merchantNote } : {}),
        }),
      });
    } catch (error) {
      throw new PaymentGatewayError("Paystack refund network failure", error);
    }

    if (response.status >= 500 || response.status === 401 || response.status === 429) {
      throw new PaymentGatewayError(`Paystack refund gateway error (HTTP ${response.status})`);
    }

    let rawJson: unknown;
    try {
      rawJson = await response.json();
    } catch (error) {
      throw new PaymentGatewayError("Invalid JSON from Paystack refund response", error);
    }

    const parsed = paystackRefundApiResponseSchema.safeParse(rawJson);
    if (!parsed.success) {
      throw new PaymentGatewayError(
        `Paystack refund response invalid: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")}`
      );
    }

    const payload = parsed.data;
    if (!payload.status || !payload.data) {
      return {
        status: "failed",
        refundId: "unknown",
        reference: String(params.transactionReferenceOrId),
        amountMinor: params.amountMinor ?? 0,
        currency: "NGN",
        rawResponse: rawJson,
      };
    }

    const refundData = payload.data;
    const refundStatus =
      refundData.status === "processed"
        ? "processed"
        : refundData.status === "pending"
          ? "pending"
          : "failed";

    return {
      status: refundStatus,
      refundId: refundData.id,
      reference: refundData.reference || String(params.transactionReferenceOrId),
      amountMinor: refundData.amount,
      currency: refundData.currency,
      refundedAt: refundData.refunded_at ? new Date(refundData.refunded_at) : undefined,
      rawResponse: refundData,
    };
  }

  verifyWebhookSignature(rawBody: string | Buffer, signature: string): boolean {
    if (!signature || !rawBody) {
      return false;
    }
    if (!this.webhookSecret) {
      return false;
    }

    if (this.isMock && signature === "mock_paystack_signature" && env.NODE_ENV !== "production") {
      return true;
    }

    const secret = this.webhookSecret;

    const computedHmac = crypto
      .createHmac("sha512", secret)
      .update(rawBody)
      .digest("hex");

    const sigBuf = Buffer.from(signature, "utf8");
    const hmacBuf = Buffer.from(computedHmac, "utf8");

    if (sigBuf.length !== hmacBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(sigBuf, hmacBuf);
  }
}

export const paystackService = new PaystackService();

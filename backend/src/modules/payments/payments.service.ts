import { prisma } from "../../database/prisma.js";
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
} from "../../common/errors/api-error.js";
import { paystackService } from "../../integrations/paystack/paystack.service.js";
import { formatCurrency } from "../../utils/money.js";
import type {
  InitializePaymentRequestDto,
  InitializePaymentResponseDto,
  VerifyPaymentResponseDto,
} from "./dto/payment.dto.js";

export class PaymentsService {
  async initializePayment(
    userId: string,
    dto: InitializePaymentRequestDto
  ): Promise<InitializePaymentResponseDto> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError("User not found");

    const order = await prisma.order.findUnique({
      where: { id: dto.orderId },
      include: { customer: true },
    });

    if (!order) throw new NotFoundError("Order not found");

    if (order.customer.userId !== userId) {
      throw new ForbiddenError("You can only pay for your own orders");
    }

    if (order.status !== "PENDING_PAYMENT") {
      throw new BadRequestError(`Order is not awaiting payment (status: ${order.status})`);
    }

    const amountMinor = Math.round(Number(order.totalAmount) * 100);
    const reference = `CHV-PAY-${order.orderNumber}-${Date.now()}`;

    const paystackResult = await paystackService.initializeTransaction({
      email: user.email,
      amountMinor,
      reference,
      ...(dto.callbackUrl ? { callbackUrl: dto.callbackUrl } : {}),
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        userId: user.id,
      },
    });

    // Create or update Payment record
    await prisma.payment.upsert({
      where: { orderId: order.id },
      create: {
        orderId: order.id,
        provider: "PAYSTACK",
        providerReference: reference,
        amount: order.totalAmount,
        currency: "NGN",
        status: "PENDING",
      },
      update: {
        providerReference: reference,
        amount: order.totalAmount,
        currency: "NGN",
        status: "PENDING",
      },
    });

    return {
      authorizationUrl: paystackResult.authorizationUrl,
      accessCode: paystackResult.accessCode,
      reference,
      orderId: order.id,
      amountMinor,
      amountFormatted: formatCurrency(amountMinor),
    };
  }

  async verifyPayment(userId: string, reference: string): Promise<VerifyPaymentResponseDto> {
    const payment = await prisma.payment.findUnique({
      where: { providerReference: reference },
      include: {
        order: {
          include: { customer: true },
        },
      },
    });

    if (!payment) {
      throw new NotFoundError("Payment transaction not found");
    }

    if (payment.order.customer.userId !== userId) {
      throw new ForbiddenError("You do not have permission to verify or view this payment transaction");
    }

    const expectedAmountMinor = Math.round(Number(payment.amount) * 100);

    // Idempotency: if already confirmed, return current state
    if (payment.status === "SUCCESS") {
      return {
        orderId: payment.orderId,
        reference: payment.providerReference,
        status: "SUCCESS",
        paidAt: payment.paidAt?.toISOString(),
        amountMinor: expectedAmountMinor,
      };
    }

    const verifyResult = await paystackService.verifyTransaction(reference, expectedAmountMinor);

    if (verifyResult.status === "success") {
      // Security Check: Verified amount must match the authoritative order amount in the database
      if (verifyResult.amountMinor !== expectedAmountMinor) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: "FAILED" },
        });
        throw new BadRequestError(
          `Payment amount mismatch: expected ${expectedAmountMinor} kobo but received ${verifyResult.amountMinor} kobo`
        );
      }

      // Security Check: Currency must match
      if (verifyResult.currency && verifyResult.currency !== payment.currency) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: "FAILED" },
        });
        throw new BadRequestError(
          `Payment currency mismatch: expected ${payment.currency} but received ${verifyResult.currency}`
        );
      }

      await this.processPaymentSuccess(payment.id, payment.orderId, verifyResult);
      return {
        orderId: payment.orderId,
        reference: payment.providerReference,
        status: "SUCCESS",
        paidAt: verifyResult.paidAt ? verifyResult.paidAt.toISOString() : new Date().toISOString(),
        amountMinor: expectedAmountMinor,
      };
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "FAILED" },
    });

    return {
      orderId: payment.orderId,
      reference: payment.providerReference,
      status: "FAILED",
      paidAt: null,
      amountMinor: expectedAmountMinor,
    };
  }

  async handleWebhook(rawBody: string | Buffer, signature: string): Promise<{ received: boolean }> {
    const isValid = paystackService.verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      throw new BadRequestError("Invalid webhook signature");
    }

    const payloadStr = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");
    let rawPayload: unknown;
    try {
      rawPayload = JSON.parse(payloadStr);
    } catch {
      throw new BadRequestError("Invalid webhook payload JSON");
    }

    const { z } = await import("zod");
    const webhookEventSchema = z.object({
      event: z.string().min(1),
      data: z
        .object({
          reference: z.string().min(1),
          status: z.string().min(1),
          amount: z.number().int().positive(),
          currency: z.literal("NGN"),
          paid_at: z.string().nullable().optional(),
          channel: z.string().nullable().optional(),
        })
        .passthrough(),
    });

    const parsed = webhookEventSchema.safeParse(rawPayload);
    if (!parsed.success) {
      // Safely ignore unsupported or malformed events without throwing or leaking
      return { received: true };
    }

    const event = parsed.data;

    if (event.event === "charge.success" && event.data.status === "success") {
      const payment = await prisma.payment.findUnique({
        where: { providerReference: event.data.reference },
      });

      if (!payment) {
        return { received: true };
      }

      // Idempotency: avoid duplicate processing if already SUCCESS
      if (payment.status === "SUCCESS") {
        return { received: true };
      }

      const expectedAmountMinor = Math.round(Number(payment.amount) * 100);

      // Security check: Webhook amount must match expected amount
      if (event.data.amount !== expectedAmountMinor) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: "FAILED",
            providerResponse: {
              error: "AMOUNT_MISMATCH",
              receivedAmount: event.data.amount,
              expectedAmount: expectedAmountMinor,
            },
          },
        });
        return { received: true };
      }

      // Security check: Webhook currency must match payment currency
      if (event.data.currency !== payment.currency) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: "FAILED",
            providerResponse: {
              error: "CURRENCY_MISMATCH",
              receivedCurrency: event.data.currency,
              expectedCurrency: payment.currency,
            },
          },
        });
        return { received: true };
      }

      await this.processPaymentSuccess(payment.id, payment.orderId, {
        amountMinor: event.data.amount,
        paidAt: event.data.paid_at ? new Date(event.data.paid_at) : new Date(),
      });
    }

    return { received: true };
  }

  private async processPaymentSuccess(
    paymentId: string,
    orderId: string,
    verifyResult: { paidAt?: Date; amountMinor: number }
  ) {
    const paidAt = verifyResult.paidAt || new Date();
    let customerUserId: string | null = null;
    let orderNumber: string | null = null;

    await prisma.$transaction(async (tx) => {
      // 1. Atomic database-level conditional update on Payment status
      // If another concurrent request or webhook already updated it to SUCCESS, updateCount is 0.
      const updateResult = await tx.payment.updateMany({
        where: {
          id: paymentId,
          status: { not: "SUCCESS" },
        },
        data: {
          status: "SUCCESS",
          paidAt,
        },
      });

      if (updateResult.count === 0) {
        // Already processed atomically by a concurrent thread
        return;
      }

      // 2. Fetch order to inspect status and calculate delivery
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { customer: true },
      });
      if (!order) return;

      customerUserId = order.customer.userId;
      orderNumber = order.orderNumber;

      // 3. Safety guard: Validate order state before confirmation
      // If the order was already cancelled, rejected, or refunded, do NOT revive it to CONFIRMED.
      if (order.status === "CANCELLED" || order.status === "REJECTED") {
        await tx.orderStatusHistory.create({
          data: {
            orderId,
            fromStatus: order.status,
            toStatus: order.status,
            reason: `Payment succeeded after order was in terminal status (${order.status}). Marked for manual review/refund.`,
          },
        });
        await tx.payment.update({
          where: { id: paymentId },
          data: {
            providerResponse: {
              reconciliationRequired: true,
              orderStatus: order.status,
              reason: "Payment succeeded after order was in terminal status",
              amountMinor: verifyResult.amountMinor,
              paidAt: paidAt.toISOString(),
            },
          },
        });
        return;
      }

      // If the order is already confirmed or in progress, avoid duplicate status history
      if (order.status !== "PENDING_PAYMENT" && order.status !== "PENDING") {
        return;
      }

      // 4. Transition Order to CONFIRMED
      await tx.order.update({
        where: { id: orderId },
        data: { status: "CONFIRMED" },
      });

      // 5. Add Order Status History
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: "CONFIRMED",
          reason: "Payment verified successfully",
        },
      });

      // 6. Create or ready the Delivery record
      const riderEarnings = Number(order.deliveryFee) - Number(order.deliveryCommission);

      await tx.delivery.upsert({
        where: { orderId },
        create: {
          orderId,
          status: "READY",
          deliveryFee: order.deliveryFee,
          choviaCommission: order.deliveryCommission,
          riderEarnings: Math.max(0, riderEarnings),
          deliveryDistanceKm: order.deliveryDistanceKm,
        },
        update: {
          status: "READY",
        },
      });
    });

    if (customerUserId && orderNumber) {
      try {
        const { enqueuePushNotification, enqueueDeliveryTimeoutCheck } = await import(
          "../../jobs/queues/index.js"
        );
        await enqueuePushNotification({
          userId: customerUserId,
          title: "Order Confirmed",
          body: `Your payment for order #${orderNumber} was successful. The restaurant is preparing your food.`,
          data: { orderId },
        });
        await enqueueDeliveryTimeoutCheck({ orderId, deliveryId: orderId }, 15 * 60 * 1000);
      } catch {
        // Asynchronous queue failure does not affect committed transaction
      }
    }
  }
}

export const paymentsService = new PaymentsService();

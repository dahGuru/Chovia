import { prisma } from "../../database/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";
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
  RefundResponseDto,
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
          include: { customer: true, refund: true },
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
          reference: z.string().min(1).optional(),
          transaction_reference: z.string().optional(),
          status: z.string().min(1).optional(),
          amount: z.number().int().positive().optional(),
          currency: z.literal("NGN").optional(),
          paid_at: z.string().nullable().optional(),
          channel: z.string().nullable().optional(),
          id: z.union([z.number(), z.string()]).optional(),
        })
        .passthrough(),
    });

    const parsed = webhookEventSchema.safeParse(rawPayload);
    if (!parsed.success) {
      // Safely ignore unsupported or malformed events without throwing or leaking
      return { received: true };
    }

    const event = parsed.data;

    // 1. Charge Success Event
    if (event.event === "charge.success" && event.data.status === "success" && event.data.reference) {
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
      if (event.data.amount && event.data.amount !== expectedAmountMinor) {
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
      if (event.data.currency && event.data.currency !== payment.currency) {
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
        amountMinor: event.data.amount || expectedAmountMinor,
        paidAt: event.data.paid_at ? new Date(event.data.paid_at) : new Date(),
        transactionId: event.data.id,
      });
    }

    // 2. Refund Events
    if (event.event === "refund.processed" || event.event === "refund.failed") {
      const refIdentifier = event.data.reference || event.data.transaction_reference;
      if (refIdentifier) {
        const refund = await prisma.refund.findFirst({
          where: {
            OR: [
              { providerReference: refIdentifier },
              { order: { payment: { providerReference: refIdentifier } } },
            ],
          },
        });

        if (refund) {
          const isProcessed = event.event === "refund.processed";
          await prisma.refund.update({
            where: { id: refund.id },
            data: {
              status: isProcessed ? "REFUNDED" : "FAILED",
              completedAt: isProcessed ? new Date() : null,
              providerResponse: event.data as Prisma.InputJsonValue,
            },
          });

          await prisma.auditLog.create({
            data: {
              action: "REFUND",
              entityType: "Refund",
              entityId: refund.id,
              after: {
                status: isProcessed ? "REFUNDED" : "FAILED",
                providerEvent: event.event,
              },
            },
          });
        }
      }
    }

    return { received: true };
  }

  async requestRefund(
    actorUserId: string,
    orderId: string,
    amountMinor?: number,
    reason?: string
  ): Promise<RefundResponseDto> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true, refund: true },
    });

    if (!order) {
      throw new NotFoundError("Order not found");
    }

    if (!order.payment || order.payment.status !== "SUCCESS") {
      throw new BadRequestError("Only orders with verified, successful payments can be refunded");
    }

    if (order.refund) {
      if (order.refund.status === "REFUNDED") {
        throw new BadRequestError("This order has already been fully refunded");
      }
      if (order.refund.status === "REFUND_PENDING") {
        throw new BadRequestError("A refund is already pending for this order");
      }
    }

    const totalPaidMinor = Math.round(Number(order.payment.amount) * 100);
    const refundAmountMinor = amountMinor ?? totalPaidMinor;

    if (refundAmountMinor <= 0) {
      throw new BadRequestError("Refund amount must be a positive integer");
    }

    if (refundAmountMinor > totalPaidMinor) {
      throw new BadRequestError(
        `Refund amount (${refundAmountMinor} kobo) cannot exceed original payment amount (${totalPaidMinor} kobo)`
      );
    }

    const refund = await prisma.$transaction(async (tx) => {
      const createdRefund = await tx.refund.upsert({
        where: { orderId: order.id },
        create: {
          orderId: order.id,
          amount: refundAmountMinor / 100,
          currency: "NGN",
          status: "REFUND_PENDING",
          reason: reason ?? "Administrative refund",
        },
        update: {
          amount: refundAmountMinor / 100,
          currency: "NGN",
          status: "REFUND_PENDING",
          reason: reason ?? "Administrative refund",
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId,
          action: "REFUND",
          entityType: "Order",
          entityId: order.id,
          metadata: {
            paymentId: order.payment?.id,
            refundAmountMinor,
            reason: reason ?? "Administrative refund",
          },
        },
      });

      return createdRefund;
    });

    // Call Paystack refund provider API
    const paystackRefundResult = await paystackService.createRefund({
      transactionReferenceOrId: order.payment.providerReference,
      amountMinor: refundAmountMinor,
      merchantNote: reason,
    });

    const isCompleted = paystackRefundResult.status === "processed";
    const updatedRefund = await prisma.refund.update({
      where: { id: refund.id },
      data: {
        status: isCompleted ? "REFUNDED" : "REFUND_PENDING",
        providerReference: paystackRefundResult.reference,
        completedAt: isCompleted ? (paystackRefundResult.refundedAt ?? new Date()) : null,
        providerResponse: paystackRefundResult.rawResponse as Prisma.InputJsonValue,
      },
    });

    return {
      id: updatedRefund.id,
      orderId: updatedRefund.orderId,
      amountMinor: Math.round(Number(updatedRefund.amount) * 100),
      currency: updatedRefund.currency,
      status: updatedRefund.status,
      reason: updatedRefund.reason,
      requestedAt: updatedRefund.requestedAt.toISOString(),
      completedAt: updatedRefund.completedAt ? updatedRefund.completedAt.toISOString() : null,
    };
  }

  private async processPaymentSuccess(
    paymentId: string,
    orderId: string,
    verifyResult: { paidAt?: Date | undefined; amountMinor: number; transactionId?: string | number | undefined }
  ) {
    const paidAt = verifyResult.paidAt || new Date();
    const providerTransactionId = verifyResult.transactionId ? String(verifyResult.transactionId) : undefined;
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
          ...(providerTransactionId ? { providerTransactionId } : {}),
        },
      });

      if (updateResult.count === 0) {
        // Already processed atomically by a concurrent thread
        return;
      }

      // 2. Fetch order to inspect status and calculate delivery
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { customer: true, refund: true },
      });
      if (!order) return;

      customerUserId = order.customer.userId;
      orderNumber = order.orderNumber;

      // 3. Safety guard: Validate refund state before confirmation
      // If a refund has already been completed or is pending, do NOT confirm the order!
      if (order.refund && (order.refund.status === "REFUNDED" || order.refund.status === "REFUND_PENDING")) {
        await tx.orderStatusHistory.create({
          data: {
            orderId,
            fromStatus: order.status,
            toStatus: order.status,
            reason: `Payment received after order was marked for refund (${order.refund.status}). Order remains ${order.status}; reconciliation required.`,
          },
        });
        await tx.payment.update({
          where: { id: paymentId },
          data: {
            providerResponse: {
              reconciliationRequired: true,
              refundStatus: order.refund.status,
              reason: "Payment verified but order has refund record",
              amountMinor: verifyResult.amountMinor,
              paidAt: paidAt.toISOString(),
            },
          },
        });
        return;
      }

      // 4. Safety guard: Validate terminal order states before confirmation
      // If the order was already cancelled or rejected, do NOT revive it to CONFIRMED.
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

      // If the order is already confirmed or in progress, avoid duplicate status history and delivery
      if (order.status !== "PENDING_PAYMENT" && order.status !== "PENDING") {
        return;
      }

      // 5. Transition Order to CONFIRMED
      await tx.order.update({
        where: { id: orderId },
        data: { status: "CONFIRMED" },
      });

      // 6. Add Order Status History
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: "CONFIRMED",
          reason: "Payment verified successfully",
        },
      });

      // 7. Create initial Delivery record in non-dispatchable PENDING state
      // Note: The delivery is NOT marked READY until the restaurant explicitly finishes preparation!
      const riderEarnings = Number(order.deliveryFee) - Number(order.deliveryCommission);

      await tx.delivery.upsert({
        where: { orderId },
        create: {
          orderId,
          status: "PENDING",
          deliveryFee: order.deliveryFee,
          choviaCommission: order.deliveryCommission,
          riderEarnings: Math.max(0, riderEarnings),
          deliveryDistanceKm: order.deliveryDistanceKm,
        },
        update: {
          // If already existing in pre-confirmation state, keep as PENDING
          status: "PENDING",
        },
      });

      // 8. Transactional Outbox: Durably schedule post-payment notification event
      // Guarantees reliable eventual delivery without losing notifications even if queues are temporarily down
      await tx.outboxEvent.create({
        data: {
          eventType: "ORDER_CONFIRMED_NOTIFICATION",
          aggregateType: "ORDER",
          aggregateId: orderId,
          payload: {
            userId: customerUserId,
            title: "Order Confirmed",
            body: `Your payment for order #${orderNumber} was successful. The restaurant is preparing your food.`,
            data: { orderId },
          },
          status: "PENDING",
        },
      });
    });

    // Best-effort immediate dispatch from outbox to avoid waiting for cron if workers are active
    if (customerUserId && orderNumber) {
      try {
        const { outboxDispatcher } = await import("../../jobs/outbox/outbox.dispatcher.js");
        await outboxDispatcher.dispatchPendingEvents();
      } catch {
        // Safe: outbox record is already durably committed to PostgreSQL
      }
    }
  }
}

export const paymentsService = new PaymentsService();

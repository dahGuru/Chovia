import { prisma } from "../../database/prisma.js";
import { enqueuePushNotification, enqueueDeliveryTimeoutCheck } from "../queues/index.js";
import type { SendPushNotificationJobData, CheckDeliveryTimeoutJobData } from "../types/jobs.types.js";

const MAX_OUTBOX_ATTEMPTS = 5;

export class OutboxDispatcher {
  async dispatchPendingEvents(batchSize = 25): Promise<number> {
    const now = new Date();

    const pendingEvents = await prisma.outboxEvent.findMany({
      where: {
        status: "PENDING",
        scheduledAt: { lte: now },
      },
      orderBy: { createdAt: "asc" },
      take: batchSize,
    });

    let dispatchedCount = 0;

    for (const event of pendingEvents) {
      // 1. Safe atomic claim under concurrent workers
      const claimResult = await prisma.outboxEvent.updateMany({
        where: { id: event.id, status: "PENDING" },
        data: {
          status: "PROCESSING",
          attempts: { increment: 1 },
        },
      });

      if (claimResult.count === 0) {
        // Concurrently claimed by another process
        continue;
      }

      try {
        switch (event.eventType) {
          case "ORDER_CONFIRMED_NOTIFICATION": {
            const payload = event.payload as unknown as SendPushNotificationJobData;
            await enqueuePushNotification(payload);
            break;
          }

          case "DISPATCH_DELIVERY": {
            const payload = event.payload as unknown as CheckDeliveryTimeoutJobData;
            await enqueueDeliveryTimeoutCheck(payload, 0);
            break;
          }

          default:
            // Unknown event type: record error and mark processed to avoid poison pill
            throw new Error(`Unsupported outbox eventType: ${event.eventType}`);
        }

        // 2. Mark event DISPATCHED
        await prisma.outboxEvent.update({
          where: { id: event.id },
          data: {
            status: "DISPATCHED",
            processedAt: new Date(),
            lastError: null,
          },
        });

        dispatchedCount++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown outbox error";
        const isTerminal = event.attempts + 1 >= MAX_OUTBOX_ATTEMPTS;

        // Exponential backoff for retries: 5s, 10s, 20s, 40s
        const backoffSeconds = Math.min(300, Math.pow(2, event.attempts) * 5);
        const nextScheduledAt = new Date(Date.now() + backoffSeconds * 1000);

        await prisma.outboxEvent.update({
          where: { id: event.id },
          data: {
            status: isTerminal ? "FAILED" : "PENDING",
            scheduledAt: nextScheduledAt,
            lastError: errorMessage,
          },
        });
      }
    }

    return dispatchedCount;
  }
}

export const outboxDispatcher = new OutboxDispatcher();

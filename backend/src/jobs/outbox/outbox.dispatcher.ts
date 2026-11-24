import { prisma } from "../../database/prisma.js";
import { enqueuePushNotification, enqueueDeliveryTimeoutCheck } from "../queues/index.js";
import type { SendPushNotificationJobData, CheckDeliveryTimeoutJobData } from "../types/jobs.types.js";

const MAX_OUTBOX_ATTEMPTS = 5;
const DEFAULT_LEASE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export class OutboxDispatcher {
  private timer: NodeJS.Timeout | null = null;
  private isPolling = false;
  private isRunning = false;

  /**
   * Recovers events stuck in PROCESSING due to worker crashes or lease expiration.
   */
  async recoverStaleProcessingEvents(leaseDurationMs = DEFAULT_LEASE_DURATION_MS): Promise<number> {
    const staleThreshold = new Date(Date.now() - leaseDurationMs);

    const staleEvents = await prisma.outboxEvent.findMany({
      where: {
        status: "PROCESSING",
        updatedAt: { lte: staleThreshold },
      },
      take: 50,
    });

    let recoveredCount = 0;

    for (const event of staleEvents) {
      const isTerminal = event.attempts >= MAX_OUTBOX_ATTEMPTS;
      const backoffSeconds = Math.min(300, Math.pow(2, Math.min(event.attempts, 6)) * 5);
      const jitter = Math.floor(Math.random() * 5);
      const nextScheduledAt = new Date(Date.now() + (backoffSeconds + jitter) * 1000);

      const updateResult = await prisma.outboxEvent.updateMany({
        where: {
          id: event.id,
          status: "PROCESSING",
          updatedAt: { lte: staleThreshold },
        },
        data: {
          status: isTerminal ? "FAILED" : "PENDING",
          scheduledAt: isTerminal ? event.scheduledAt : nextScheduledAt,
          lastError: isTerminal
            ? `Lease expired after ${event.attempts} attempts; marked FAILED.`
            : `Lease expired after ${event.attempts} attempts; recovered for retry.`,
        },
      });

      if (updateResult.count > 0) {
        recoveredCount++;
      }
    }

    return recoveredCount;
  }

  /**
   * Claims and dispatches a bounded batch of pending outbox events.
   */
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
      // 2. Safe atomic claim under concurrent workers
      const claimResult = await prisma.outboxEvent.updateMany({
        where: { id: event.id, status: "PENDING" },
        data: {
          status: "PROCESSING",
          attempts: { increment: 1 },
        },
      });

      if (claimResult.count === 0) {
        // Concurrently claimed by another worker instance
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
            throw new Error(`Unsupported outbox eventType: ${event.eventType}`);
        }

        // 3. Mark event DISPATCHED
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
        const currentAttempts = event.attempts + 1;
        const isTerminal = currentAttempts >= MAX_OUTBOX_ATTEMPTS;

        // Exponential backoff with jitter: (2^attempts * 5s) + [0..4]s
        const backoffSeconds = Math.min(300, Math.pow(2, Math.min(currentAttempts, 6)) * 5);
        const jitter = Math.floor(Math.random() * 5);
        const nextScheduledAt = new Date(Date.now() + (backoffSeconds + jitter) * 1000);

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

  /**
   * Starts the continuous background outbox dispatcher loop.
   */
  start(intervalMs = 10000): void {
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;

    const poll = async () => {
      if (!this.isRunning || this.isPolling) {
        return;
      }
      this.isPolling = true;
      try {
        await this.recoverStaleProcessingEvents();
        await this.dispatchPendingEvents();
      } catch (error) {
        console.error("[OUTBOX] Error during dispatch cycle:", error);
      } finally {
        this.isPolling = false;
      }
    };

    // Execute first run immediately, then poll continuously
    void poll();
    this.timer = setInterval(() => {
      void poll();
    }, intervalMs);

    console.log(`[OUTBOX] Outbox dispatcher loop started (interval: ${intervalMs}ms)`);
  }

  /**
   * Gracefully stops the outbox dispatcher loop.
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    // Wait for in-flight polling cycle to complete
    while (this.isPolling) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    console.log("[OUTBOX] Outbox dispatcher loop stopped gracefully.");
  }
}

export const outboxDispatcher = new OutboxDispatcher();

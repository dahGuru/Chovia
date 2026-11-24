import type { Worker } from "bullmq";
import { createEmailWorker } from "./workers/email.worker.js";
import { createNotificationWorker } from "./workers/notification.worker.js";
import { createDeliveryWorker } from "./workers/delivery.worker.js";
import { closeQueues } from "./queues/index.js";

export * from "./constants/jobs.constants.js";
export * from "./types/jobs.types.js";
export * from "./queues/index.js";
export * from "./outbox/outbox.dispatcher.js";

const activeWorkers: Worker[] = [];

export function startWorkers(): Worker[] {
  const emailWorker = createEmailWorker();
  if (emailWorker) activeWorkers.push(emailWorker);

  const notificationWorker = createNotificationWorker();
  if (notificationWorker) activeWorkers.push(notificationWorker);

  const deliveryWorker = createDeliveryWorker();
  if (deliveryWorker) activeWorkers.push(deliveryWorker);

  return activeWorkers;
}

export async function stopWorkers(): Promise<void> {
  await Promise.allSettled(activeWorkers.map((w) => w.close()));
  activeWorkers.length = 0;
  await closeQueues();
}

import crypto from "node:crypto";
import { Queue } from "bullmq";
import { env } from "../../config/env.js";
import { parseRedisUrl } from "../../cache/redis.js";
import { QUEUE_NAMES, JOB_NAMES } from "../constants/jobs.constants.js";
import type {
  SendVerificationEmailJobData,
  SendPasswordResetEmailJobData,
  SendStaffInviteEmailJobData,
  SendPushNotificationJobData,
  CheckDeliveryTimeoutJobData,
} from "../types/jobs.types.js";

function getQueueConnection() {
  return parseRedisUrl(env.REDIS_URL);
}

export function createOpaqueJobId(prefix: string, ...inputs: (string | number)[]): string {
  const serialized = inputs
    .map((val) => {
      const str = String(val);
      return `${Buffer.byteLength(str, "utf8")}:${str}`;
    })
    .join(";");
  const digest = crypto
    .createHash("sha256")
    .update(serialized)
    .digest("hex")
    .slice(0, 24);
  return `${prefix}_${digest}`;
}

let emailQueue: Queue | null = null;
let notificationQueue: Queue | null = null;
let deliveryQueue: Queue | null = null;

const shouldBypassQueues = () => env.NODE_ENV === "test" || env.MOCK_INTEGRATIONS;

export function getEmailQueue(): Queue | null {
  if (shouldBypassQueues()) return null;
  if (!emailQueue) {
    emailQueue = new Queue(QUEUE_NAMES.EMAIL, {
      connection: getQueueConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    });
  }
  return emailQueue;
}

export function getNotificationQueue(): Queue | null {
  if (shouldBypassQueues()) return null;
  if (!notificationQueue) {
    notificationQueue = new Queue(QUEUE_NAMES.NOTIFICATIONS, {
      connection: getQueueConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 1500 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    });
  }
  return notificationQueue;
}

export function getDeliveryQueue(): Queue | null {
  if (shouldBypassQueues()) return null;
  if (!deliveryQueue) {
    deliveryQueue = new Queue(QUEUE_NAMES.DELIVERY, {
      connection: getQueueConnection(),
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    });
  }
  return deliveryQueue;
}

export async function enqueueVerificationEmail(data: SendVerificationEmailJobData): Promise<void> {
  const queue = getEmailQueue();
  if (!queue) {
    throw new Error("Email queue is unavailable");
  }
  await queue.add(JOB_NAMES.SEND_VERIFICATION_EMAIL, data, {
    jobId: createOpaqueJobId("email_verify", data.email, data.otp),
  });
}

export async function enqueuePasswordResetEmail(data: SendPasswordResetEmailJobData): Promise<void> {
  const queue = getEmailQueue();
  if (!queue) {
    throw new Error("Email queue is unavailable");
  }
  await queue.add(JOB_NAMES.SEND_PASSWORD_RESET_EMAIL, data, {
    jobId: createOpaqueJobId("email_reset", data.email, data.otp),
  });
}

export async function enqueueStaffInviteEmail(data: SendStaffInviteEmailJobData): Promise<void> {
  const queue = getEmailQueue();
  if (!queue) {
    throw new Error("Email queue is unavailable");
  }
  await queue.add(JOB_NAMES.SEND_STAFF_INVITE_EMAIL, data, {
    jobId: createOpaqueJobId("email_invite", data.email, data.inviteToken),
  });
}

export async function enqueuePushNotification(data: SendPushNotificationJobData): Promise<void> {
  const queue = getNotificationQueue();
  if (!queue) {
    throw new Error("Notification queue is unavailable");
  }
  const targetRef = data.data?.orderId || data.data?.deliveryId || "direct";
  const slug = data.title.toLowerCase().replace(/[^a-z0-9]/g, "_");
  await queue.add(JOB_NAMES.SEND_PUSH_NOTIFICATION, data, {
    jobId: createOpaqueJobId("notif", data.userId, slug, String(targetRef), data.body),
  });
}

export async function enqueueDeliveryTimeoutCheck(data: CheckDeliveryTimeoutJobData, delayMs = 120000): Promise<void> {
  const queue = getDeliveryQueue();
  if (!queue) {
    throw new Error("Delivery queue is unavailable");
  }
  await queue.add(JOB_NAMES.CHECK_DELIVERY_TIMEOUT, data, {
    jobId: createOpaqueJobId("delivery_dispatch", data.deliveryId, data.orderId),
    delay: delayMs,
  });
}

export async function closeQueues(): Promise<void> {
  await Promise.allSettled([
    emailQueue?.close(),
    notificationQueue?.close(),
    deliveryQueue?.close(),
  ]);
  emailQueue = null;
  notificationQueue = null;
  deliveryQueue = null;
}

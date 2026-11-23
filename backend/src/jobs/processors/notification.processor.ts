import type { Job } from "bullmq";
import { prisma } from "../../database/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { JOB_NAMES } from "../constants/jobs.constants.js";
import type { SendPushNotificationJobData } from "../types/jobs.types.js";

export async function processNotificationJob(job: Job): Promise<void> {
  if (job.name === JOB_NAMES.SEND_PUSH_NOTIFICATION) {
    const data = job.data as SendPushNotificationJobData;

    // 1. Idempotency check: avoid duplicate in-app notification records for the same event
    const existing = await prisma.notification.findFirst({
      where: {
        userId: data.userId,
        title: data.title,
        message: data.body,
      },
    });

    if (!existing) {
      await prisma.notification.create({
        data: {
          userId: data.userId,
          type: "SYSTEM",
          title: data.title,
          message: data.body,
          ...(data.data ? { data: data.data as Prisma.InputJsonValue } : {}),
        },
      });
    }

    // 2. Look up registered user devices
    const devices = await prisma.userDevice.findMany({
      where: { userId: data.userId, isActive: true },
    });

    if (devices.length > 0) {
      // In CHOVIA MVP, external push gateway (APNs / FCM via Expo Server SDK) is not provisioned.
      // We explicitly record that external push dispatch is unsupported at this stage rather than claiming success.
      // The in-app notification created above serves as the authoritative recipient alert.
    }
  }
}

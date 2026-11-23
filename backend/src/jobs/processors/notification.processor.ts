import type { Job } from "bullmq";
import { prisma } from "../../database/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { JOB_NAMES } from "../constants/jobs.constants.js";
import type { SendPushNotificationJobData } from "../types/jobs.types.js";
import { expoPushService, isExpoPushToken } from "../../integrations/expo/expo-push.service.js";

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

    // 2. Look up registered active user devices
    const devices = await prisma.userDevice.findMany({
      where: { userId: data.userId, isActive: true },
    });

    if (devices.length > 0) {
      const validPushMessages = devices
        .filter((d) => isExpoPushToken(d.expoPushToken))
        .map((d) => ({
          to: d.expoPushToken,
          title: data.title,
          body: data.body,
          data: data.data,
          sound: "default" as const,
        }));

      if (validPushMessages.length > 0) {
        await expoPushService.sendPushNotifications(validPushMessages);
      }
    }
  }
}

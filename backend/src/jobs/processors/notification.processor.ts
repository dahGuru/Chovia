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
    let notification = await prisma.notification.findFirst({
      where: {
        userId: data.userId,
        title: data.title,
        message: data.body,
      },
    });

    if (!notification) {
      notification = await prisma.notification.create({
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

    if (devices.length > 0 && notification) {
      const validDevices = devices.filter((d) => isExpoPushToken(d.expoPushToken));

      for (const device of validDevices) {
        // Persist QUEUED delivery record if not already created
        let delivery = await prisma.notificationDelivery.findFirst({
          where: {
            notificationId: notification.id,
            deviceId: device.id,
          },
        });

        if (!delivery) {
          delivery = await prisma.notificationDelivery.create({
            data: {
              notificationId: notification.id,
              deviceId: device.id,
              expoPushToken: device.expoPushToken,
              status: "QUEUED",
            },
          });
        }

        // If already delivered or submitted, don't resend
        if (delivery.status === "DELIVERED" || delivery.status === "SUBMITTED") {
          continue;
        }

        try {
          const tickets = await expoPushService.sendPushNotifications([
            {
              to: device.expoPushToken,
              title: data.title,
              body: data.body,
              data: data.data,
              sound: "default" as const,
            },
          ]);

          const ticket = tickets[0];
          if (ticket && ticket.status === "ok") {
            await prisma.notificationDelivery.update({
              where: { id: delivery.id },
              data: {
                status: "SUBMITTED",
                ticketId: ticket.id ?? null,
                submittedAt: new Date(),
              },
            });
          } else if (ticket && ticket.status === "error") {
            await prisma.notificationDelivery.update({
              where: { id: delivery.id },
              data: {
                status: "FAILED",
                errorMessage: ticket.message || (ticket.details?.error ? String(ticket.details.error) : "Ticket error"),
                failedAt: new Date(),
              },
            });

            if (ticket.details?.error === "DeviceNotRegistered") {
              await expoPushService.deactivateInvalidToken(device.expoPushToken);
            }
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Push submission error";
          await prisma.notificationDelivery.update({
            where: { id: delivery.id },
            data: {
              status: "FAILED",
              errorMessage,
              failedAt: new Date(),
            },
          });
        }
      }
    }
  }
}

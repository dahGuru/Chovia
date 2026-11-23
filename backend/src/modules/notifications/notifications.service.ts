import { prisma } from "../../database/prisma.js";
import { NotFoundError } from "../../common/errors/api-error.js";
import type { NotificationResponseDto } from "./dto/notification.dto.js";

export class NotificationsService {
  async list(userId: string): Promise<NotificationResponseDto[]> {
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return notifications.map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      type: n.type,
      isRead: n.readAt !== null,
      readAt: n.readAt?.toISOString() || null,
      createdAt: n.createdAt.toISOString(),
    }));
  }

  async markRead(userId: string, notificationId: string): Promise<{ success: boolean }> {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification || notification.userId !== userId) {
      throw new NotFoundError("Notification not found");
    }

    await prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });

    return { success: true };
  }

  async markAllRead(userId: string): Promise<{ success: boolean }> {
    await prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });

    return { success: true };
  }
}

export const notificationsService = new NotificationsService();

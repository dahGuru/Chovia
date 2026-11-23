import type { Job } from "bullmq";
import { prisma } from "../../database/prisma.js";
import { JOB_NAMES } from "../constants/jobs.constants.js";
import type { CheckDeliveryTimeoutJobData } from "../types/jobs.types.js";

export async function processDeliveryJob(job: Job): Promise<void> {
  if (job.name === JOB_NAMES.CHECK_DELIVERY_TIMEOUT) {
    const data = job.data as CheckDeliveryTimeoutJobData;

    const delivery = await prisma.delivery.findUnique({
      where: { id: data.deliveryId },
      include: {
        order: {
          include: {
            restaurant: true,
            customer: true,
          },
        },
      },
    });

    // Idempotency: if already assigned, picked up, or completed, skip further actions
    if (!delivery || delivery.status !== "READY" || delivery.riderId !== null) {
      return;
    }

    // Identify eligible active riders who are not currently on an active delivery
    const eligibleRiders = await prisma.riderProfile.findMany({
      where: {
        status: "ACTIVE",
        deliveries: {
          none: {
            status: { in: ["ASSIGNED", "OUT_FOR_DELIVERY"] },
          },
        },
      },
      take: 5,
    });

    const selectedRider = eligibleRiders[0];
    if (selectedRider) {
      await prisma.$transaction(async (tx) => {
        // Atomic conditional assignment: ensure delivery is still READY with riderId null
        const updateResult = await tx.delivery.updateMany({
          where: {
            id: delivery.id,
            status: "READY",
            riderId: null,
          },
          data: {
            riderId: selectedRider.id,
            status: "ASSIGNED",
            assignedAt: new Date(),
          },
        });

        if (updateResult.count === 0) {
          // Concurrently assigned by another process or rider accepted manually
          return;
        }

        // Record assignment event in history
        await tx.deliveryAssignmentEvent.create({
          data: {
            deliveryId: delivery.id,
            riderId: selectedRider.id,
            type: "ASSIGNED",
          },
        });

        // Record order status history
        await tx.orderStatusHistory.create({
          data: {
            orderId: delivery.orderId,
            fromStatus: delivery.order.status,
            toStatus: "ASSIGNED",
            reason: `Auto-dispatched to active rider ${selectedRider.firstName} ${selectedRider.lastName}`,
          },
        });

        // Update order status to ASSIGNED
        await tx.order.update({
          where: { id: delivery.orderId },
          data: { status: "ASSIGNED" },
        });

        // Notify customer that a rider was assigned
        await tx.notification.create({
          data: {
            userId: delivery.order.customer.userId,
            type: "DELIVERY_ASSIGNED",
            title: "Rider Assigned",
            message: `${selectedRider.firstName} has been assigned to deliver order #${delivery.order.orderNumber}.`,
            data: {
              orderId: delivery.orderId,
              deliveryId: delivery.id,
              riderId: selectedRider.id,
            },
          },
        });

        // Notify rider of new delivery assignment
        await tx.notification.create({
          data: {
            userId: selectedRider.userId,
            type: "NEW_DELIVERY_AVAILABLE",
            title: "New Delivery Assigned",
            message: `You have been assigned order #${delivery.order.orderNumber} from ${delivery.order.restaurant.name}.`,
            data: {
              orderId: delivery.orderId,
              deliveryId: delivery.id,
            },
          },
        });
      });
    } else {
      // No active riders currently available: log audit alert and notify customer of delay
      await prisma.auditLog.create({
        data: {
          action: "UPDATE",
          entityType: "Delivery",
          entityId: delivery.id,
          metadata: {
            alert: "DELIVERY_UNASSIGNED_TIMEOUT",
            orderId: data.orderId,
            reason: "No active riders currently available for auto-dispatch",
          },
        },
      });

      // Avoid spamming customer notifications by checking if delay notification was already sent
      const existingNotification = await prisma.notification.findFirst({
        where: {
          userId: delivery.order.customer.userId,
          title: "Finding a Rider",
        },
      });

      if (!existingNotification) {
        await prisma.notification.create({
          data: {
            userId: delivery.order.customer.userId,
            type: "SYSTEM",
            title: "Finding a Rider",
            message: `We are actively searching for an available rider for order #${delivery.order.orderNumber}. Thank you for your patience.`,
            data: {
              orderId: delivery.orderId,
              deliveryId: delivery.id,
            },
          },
        });
      }
    }
  }
}

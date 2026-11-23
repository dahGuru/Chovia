import type { Job } from "bullmq";
import { prisma } from "../../database/prisma.js";
import { JOB_NAMES } from "../constants/jobs.constants.js";
import type { CheckDeliveryTimeoutJobData } from "../types/jobs.types.js";
import { calculateHaversineDistanceKm } from "../../utils/geo.js";
import { enqueueDeliveryTimeoutCheck } from "../queues/index.js";

const MAX_DISPATCH_ATTEMPTS = 3;
const DISPATCH_RADIUS_KM = 10.0;
const LOCATION_FRESHNESS_MINUTES = 30;

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

    // 1. Invariant: Delivery must exist, be in READY state, and unassigned
    if (!delivery || delivery.status !== "READY" || delivery.riderId !== null) {
      return;
    }

    // 2. Crucial Invariant: The associated order MUST be in READY state!
    // Never dispatch or assign riders to an order that is still PENDING, CONFIRMED, or PREPARING.
    if (delivery.order.status !== "READY") {
      return;
    }

    // 3. Look up active, online, available riders without active assignments
    const activeRiders = await prisma.riderProfile.findMany({
      where: {
        status: "ACTIVE",
        isOnline: true,
        isAvailable: true,
        deliveries: {
          none: {
            status: { in: ["ASSIGNED", "OUT_FOR_DELIVERY"] },
          },
        },
      },
    });

    // 4. Filter by geographic proximity to restaurant & location freshness
    const restLat = Number(delivery.order.restaurant.latitude);
    const restLng = Number(delivery.order.restaurant.longitude);
    const freshnessCutoff = new Date(Date.now() - LOCATION_FRESHNESS_MINUTES * 60 * 1000);

    const eligibleRiders = activeRiders.filter((rider) => {
      // If rider has coordinates, verify location freshness and distance
      if (rider.lastLatitude !== null && rider.lastLongitude !== null) {
        if (rider.lastLocationUpdatedAt && rider.lastLocationUpdatedAt < freshnessCutoff) {
          return false;
        }
        const distKm = calculateHaversineDistanceKm(
          restLat,
          restLng,
          Number(rider.lastLatitude),
          Number(rider.lastLongitude)
        );
        return distKm <= DISPATCH_RADIUS_KM;
      }
      // If rider has not updated location yet (e.g. test environment or initial setup), permit assignment if active & online
      return true;
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
      // 5. No eligible riders found: track dispatch attempt and schedule durable retry with exponential backoff
      const currentAttempts = delivery.dispatchAttempts + 1;

      await prisma.delivery.update({
        where: { id: delivery.id },
        data: {
          dispatchAttempts: currentAttempts,
          lastDispatchAttemptAt: new Date(),
        },
      });

      if (currentAttempts < MAX_DISPATCH_ATTEMPTS) {
        // Schedule next retry with exponential backoff (e.g. 1m, 2m, 4m)
        const delayMs = Math.min(300000, Math.pow(2, currentAttempts - 1) * 60000);
        try {
          await enqueueDeliveryTimeoutCheck(
            { orderId: data.orderId, deliveryId: data.deliveryId },
            delayMs
          );
        } catch {
          // If queue is down, outbox or worker loop will retry
        }

        // Notify customer on initial search delay only to avoid notification spam
        if (currentAttempts === 1) {
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
      } else {
        // Max attempts reached: escalate to manual operations / alert restaurant and admin
        await prisma.auditLog.create({
          data: {
            action: "UPDATE",
            entityType: "Delivery",
            entityId: delivery.id,
            metadata: {
              alert: "DISPATCH_RETRY_EXHAUSTED",
              orderId: data.orderId,
              attempts: currentAttempts,
              reason: "Maximum automated dispatch attempts reached without finding an available rider. Requires manual assignment.",
            },
          },
        });
      }
    }
  }
}

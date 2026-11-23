import { prisma } from "../../database/prisma.js";
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
} from "../../common/errors/api-error.js";
import { formatCurrency } from "../../utils/money.js";
import type {
  UpdateRiderStatusDto,
  DeliveryResponseDto,
  DeliveryTrackingResponseDto,
} from "./dto/delivery.dto.js";

interface DeliveryWithOrder {
  id: string;
  orderId: string;
  order: {
    orderNumber: string;
    deliveryAddressText: string;
    restaurant: { name: string; address: string };
  };
  deliveryDistanceKm?: unknown;
  riderEarnings: unknown;
  status: string;
  assignedAt?: Date | null;
  pickedUpAt?: Date | null;
  deliveredAt?: Date | null;
  createdAt: Date;
}

function serializeDelivery(delivery: DeliveryWithOrder): DeliveryResponseDto {
  const riderEarningsMinor = Math.round(Number(delivery.riderEarnings) * 100);

  return {
    id: delivery.id,
    orderId: delivery.orderId,
    orderNumber: delivery.order.orderNumber,
    restaurantName: delivery.order.restaurant.name,
    restaurantAddress: delivery.order.restaurant.address,
    deliveryAddressText: delivery.order.deliveryAddressText,
    distanceKm: delivery.deliveryDistanceKm ? Number(delivery.deliveryDistanceKm) : null,
    riderEarningsMinor,
    riderEarningsFormatted: formatCurrency(riderEarningsMinor),
    status: delivery.status,
    assignedAt: delivery.assignedAt?.toISOString(),
    pickedUpAt: delivery.pickedUpAt?.toISOString(),
    deliveredAt: delivery.deliveredAt?.toISOString(),
    createdAt: delivery.createdAt.toISOString(),
  };
}

export class DeliveryService {
  private async getRiderProfile(userId: string) {
    const rider = await prisma.riderProfile.findUnique({
      where: { userId },
    });
    if (!rider) {
      throw new ForbiddenError("Rider profile not found for this user");
    }
    return rider;
  }

  async updateRiderStatus(userId: string, dto: UpdateRiderStatusDto): Promise<{ status: string }> {
    const rider = await this.getRiderProfile(userId);

    const updated = await prisma.riderProfile.update({
      where: { id: rider.id },
      data: {
        status: dto.status,
      },
    });

    return { status: updated.status };
  }

  async getAvailableDeliveries(userId: string): Promise<DeliveryResponseDto[]> {
    await this.getRiderProfile(userId);

    const deliveries = await prisma.delivery.findMany({
      where: {
        status: "READY",
        riderId: null,
      },
      include: {
        order: {
          include: {
            restaurant: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 20,
    });

    return deliveries.map(serializeDelivery);
  }

  async acceptDelivery(userId: string, deliveryId: string): Promise<DeliveryResponseDto> {
    const rider = await this.getRiderProfile(userId);

    const delivery = await prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: { order: true },
    });

    if (!delivery) {
      throw new NotFoundError("Delivery not found");
    }

    if (delivery.status !== "READY" || delivery.riderId !== null) {
      throw new BadRequestError("This delivery has already been assigned or is not available");
    }

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Assign delivery to rider
      const d = await tx.delivery.update({
        where: { id: deliveryId },
        data: {
          riderId: rider.id,
          status: "ASSIGNED",
          assignedAt: new Date(),
        },
        include: {
          order: {
            include: { restaurant: true },
          },
        },
      });

      // 2. Create Assignment Event
      await tx.deliveryAssignmentEvent.create({
        data: {
          deliveryId,
          riderId: rider.id,
          type: "ASSIGNED",
        },
      });

      // 3. Update order status history
      await tx.orderStatusHistory.create({
        data: {
          orderId: delivery.orderId,
          fromStatus: delivery.order.status,
          toStatus: "ASSIGNED",
          reason: `Assigned to rider ${rider.firstName} ${rider.lastName}`,
          actorUserId: userId,
        },
      });

      // 4. Update order status
      await tx.order.update({
        where: { id: delivery.orderId },
        data: { status: "ASSIGNED" },
      });

      return d;
    });

    return serializeDelivery(updated);
  }

  async pickupDelivery(userId: string, deliveryId: string): Promise<DeliveryResponseDto> {
    const rider = await this.getRiderProfile(userId);

    const delivery = await prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: { order: true },
    });

    if (!delivery || delivery.riderId !== rider.id) {
      throw new NotFoundError("Delivery assignment not found for this rider");
    }

    if (delivery.status !== "ASSIGNED") {
      throw new BadRequestError(`Cannot pickup delivery in status: ${delivery.status}`);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const d = await tx.delivery.update({
        where: { id: deliveryId },
        data: {
          status: "OUT_FOR_DELIVERY",
          pickedUpAt: new Date(),
        },
        include: {
          order: {
            include: { restaurant: true },
          },
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: delivery.orderId,
          fromStatus: "ASSIGNED",
          toStatus: "OUT_FOR_DELIVERY",
          reason: "Order picked up by rider and out for delivery",
          actorUserId: userId,
        },
      });

      await tx.order.update({
        where: { id: delivery.orderId },
        data: { status: "OUT_FOR_DELIVERY" },
      });

      return d;
    });

    return serializeDelivery(updated);
  }

  async completeDelivery(userId: string, deliveryId: string): Promise<DeliveryResponseDto> {
    const rider = await this.getRiderProfile(userId);

    const delivery = await prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: { order: true },
    });

    if (!delivery || delivery.riderId !== rider.id) {
      throw new NotFoundError("Delivery assignment not found for this rider");
    }

    if (delivery.status !== "OUT_FOR_DELIVERY") {
      throw new BadRequestError(`Cannot complete delivery in status: ${delivery.status}`);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const d = await tx.delivery.update({
        where: { id: deliveryId },
        data: {
          status: "DELIVERED",
          deliveredAt: new Date(),
        },
        include: {
          order: {
            include: { restaurant: true },
          },
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: delivery.orderId,
          fromStatus: "OUT_FOR_DELIVERY",
          toStatus: "DELIVERED",
          reason: "Order delivered to customer",
          actorUserId: userId,
        },
      });

      await tx.order.update({
        where: { id: delivery.orderId },
        data: { status: "DELIVERED" },
      });

      return d;
    });

    return serializeDelivery(updated);
  }

  async trackDelivery(orderId: string): Promise<DeliveryTrackingResponseDto> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        restaurant: true,
        delivery: {
          include: {
            rider: {
              include: { user: true },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundError("Order not found");
    }

    let riderInfo = null;
    if (order.delivery?.rider) {
      riderInfo = {
        name: `${order.delivery.rider.firstName} ${order.delivery.rider.lastName}`.trim(),
        phone: order.delivery.rider.user.phone,
        vehicleType: order.delivery.rider.vehicleType,
        vehiclePlateNumber: order.delivery.rider.vehiclePlateNumber,
      };
    }

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      deliveryStatus: order.delivery?.status || "NOT_READY",
      restaurant: {
        name: order.restaurant.name,
        address: order.restaurant.address,
        latitude: Number(order.restaurant.latitude),
        longitude: Number(order.restaurant.longitude),
      },
      destination: {
        addressText: order.deliveryAddressText,
        latitude: Number(order.deliveryLatitude),
        longitude: Number(order.deliveryLongitude),
      },
      rider: riderInfo,
      assignedAt: order.delivery?.assignedAt?.toISOString(),
      pickedUpAt: order.delivery?.pickedUpAt?.toISOString(),
      deliveredAt: order.delivery?.deliveredAt?.toISOString(),
    };
  }
}

export const deliveryService = new DeliveryService();

import { prisma } from "../../database/prisma.js";
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
} from "../../common/errors/api-error.js";
import { formatCurrency } from "../../utils/money.js";
import { validateRiderEligibility } from "./delivery-eligibility.js";
import type {
  UpdateRiderStatusDto,
  UpdateRiderLocationDto,
  RiderStatusResponseDto,
  RiderSessionProfileResponseDto,
  ListRiderDeliveryHistoryQueryDto,
  PaginatedRiderDeliveryHistoryDto,
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
      include: {
        deliveries: {
          where: {
            status: { in: ["ASSIGNED", "OUT_FOR_DELIVERY"] },
          },
        },
      },
    });
    if (!rider) {
      throw new ForbiddenError("Rider profile not found for this user");
    }
    return rider;
  }

  async getRiderSessionProfile(userId: string): Promise<RiderSessionProfileResponseDto> {
    const rider = await prisma.riderProfile.findUnique({
      where: { userId },
      include: {
        kycApplication: {
          select: { status: true, rejectionReason: true },
        },
        deliveries: {
          where: { status: { in: ["ASSIGNED", "OUT_FOR_DELIVERY"] } },
          select: { id: true },
        },
      },
    });

    if (!rider) {
      throw new ForbiddenError("Rider profile not found for this user");
    }

    return {
      id: rider.id,
      userId: rider.userId,
      firstName: rider.firstName,
      lastName: rider.lastName,
      status: rider.status,
      isOnline: rider.isOnline,
      isAvailable: rider.isAvailable,
      operatingCity: rider.operatingCity,
      vehicleType: rider.vehicleType,
      vehiclePlateNumber: rider.vehiclePlateNumber,
      lastLatitude: rider.lastLatitude !== null ? Number(rider.lastLatitude) : null,
      lastLongitude: rider.lastLongitude !== null ? Number(rider.lastLongitude) : null,
      lastLocationUpdatedAt: rider.lastLocationUpdatedAt
        ? rider.lastLocationUpdatedAt.toISOString()
        : null,
      kycStatus: rider.kycApplication?.status ?? "NOT_SUBMITTED",
      kycRejectionReason: rider.kycApplication?.rejectionReason ?? null,
      activeDeliveryCount: rider.deliveries.length,
    };
  }

  async updateRiderStatus(
    userId: string,
    dto: UpdateRiderStatusDto
  ): Promise<RiderStatusResponseDto> {
    const rider = await this.getRiderProfile(userId);
    const targetOnline = dto.isOnline ?? dto.status === "ACTIVE";

    if (targetOnline) {
      if (rider.status !== "ACTIVE") {
        throw new ForbiddenError(
          `Your rider account is ${rider.status}. Complete KYC approval before going online.`
        );
      }

      if (
        dto.latitude === undefined ||
        dto.longitude === undefined ||
        !Number.isFinite(dto.latitude) ||
        !Number.isFinite(dto.longitude)
      ) {
        throw new BadRequestError(
          "Valid GPS coordinates (latitude and longitude) are required to go online"
        );
      }

      const hasActiveDelivery = rider.deliveries.length > 0;
      const updated = await prisma.riderProfile.update({
        where: { id: rider.id },
        data: {
          isOnline: true,
          isAvailable: !hasActiveDelivery,
          lastLatitude: dto.latitude,
          lastLongitude: dto.longitude,
          lastLocationUpdatedAt: new Date(),
        },
      });

      return {
        status: updated.status,
        isOnline: updated.isOnline,
        isAvailable: updated.isAvailable,
        lastLatitude: updated.lastLatitude !== null ? Number(updated.lastLatitude) : null,
        lastLongitude: updated.lastLongitude !== null ? Number(updated.lastLongitude) : null,
        lastLocationUpdatedAt: updated.lastLocationUpdatedAt
          ? updated.lastLocationUpdatedAt.toISOString()
          : null,
      };
    }

    // Going offline MUST preserve RiderProfile.status and only toggle shift flags
    const updated = await prisma.riderProfile.update({
      where: { id: rider.id },
      data: {
        isOnline: false,
        isAvailable: false,
        ...(dto.latitude !== undefined && dto.longitude !== undefined
          ? {
              lastLatitude: dto.latitude,
              lastLongitude: dto.longitude,
              lastLocationUpdatedAt: new Date(),
            }
          : {}),
      },
    });

    return {
      status: updated.status,
      isOnline: updated.isOnline,
      isAvailable: updated.isAvailable,
      lastLatitude: updated.lastLatitude !== null ? Number(updated.lastLatitude) : null,
      lastLongitude: updated.lastLongitude !== null ? Number(updated.lastLongitude) : null,
      lastLocationUpdatedAt: updated.lastLocationUpdatedAt
        ? updated.lastLocationUpdatedAt.toISOString()
        : null,
    };
  }

  async updateRiderLocation(
    userId: string,
    dto: UpdateRiderLocationDto
  ): Promise<RiderStatusResponseDto> {
    const rider = await this.getRiderProfile(userId);
    if (rider.status !== "ACTIVE") {
      throw new ForbiddenError(`Cannot update location while rider profile status is ${rider.status}`);
    }

    const updated = await prisma.riderProfile.update({
      where: { id: rider.id },
      data: {
        lastLatitude: dto.latitude,
        lastLongitude: dto.longitude,
        lastLocationUpdatedAt: new Date(),
      },
    });

    return {
      status: updated.status,
      isOnline: updated.isOnline,
      isAvailable: updated.isAvailable,
      lastLatitude: updated.lastLatitude !== null ? Number(updated.lastLatitude) : null,
      lastLongitude: updated.lastLongitude !== null ? Number(updated.lastLongitude) : null,
      lastLocationUpdatedAt: updated.lastLocationUpdatedAt
        ? updated.lastLocationUpdatedAt.toISOString()
        : null,
    };
  }

  async getAvailableDeliveries(userId: string): Promise<DeliveryResponseDto[]> {
    const rider = await this.getRiderProfile(userId);
    if (rider.status !== "ACTIVE") {
      throw new ForbiddenError(
        `Rider account status is ${rider.status}. Only approved ACTIVE riders can view open deliveries.`
      );
    }

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

  async getActiveDelivery(userId: string): Promise<DeliveryResponseDto | null> {
    const rider = await this.getRiderProfile(userId);
    const active = await prisma.delivery.findFirst({
      where: {
        riderId: rider.id,
        status: { in: ["ASSIGNED", "OUT_FOR_DELIVERY"] },
      },
      include: {
        order: {
          include: {
            restaurant: true,
          },
        },
      },
      orderBy: { assignedAt: "desc" },
    });

    return active ? serializeDelivery(active) : null;
  }

  async getDeliveryHistory(
    userId: string,
    query: ListRiderDeliveryHistoryQueryDto
  ): Promise<PaginatedRiderDeliveryHistoryDto> {
    const rider = await this.getRiderProfile(userId);

    const where = query.status
      ? { riderId: rider.id, status: query.status }
      : { riderId: rider.id };

    const [total, deliveries, earningsAggregate] = await Promise.all([
      prisma.delivery.count({ where }),
      prisma.delivery.findMany({
        where,
        include: {
          order: {
            include: {
              restaurant: true,
            },
          },
        },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ deliveredAt: "desc" }, { assignedAt: "desc" }, { createdAt: "desc" }],
      }),
      prisma.delivery.aggregate({
        where: { riderId: rider.id, status: "DELIVERED" },
        _sum: { riderEarnings: true },
      }),
    ]);

    const totalEarningsMinor = Math.round(
      Number(earningsAggregate._sum.riderEarnings ?? 0) * 100
    );

    return {
      items: deliveries.map(serializeDelivery),
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit) || 1,
      totalEarningsMinor,
      totalEarningsFormatted: formatCurrency(totalEarningsMinor),
    };
  }

  async acceptDelivery(userId: string, deliveryId: string): Promise<DeliveryResponseDto> {
    const rider = await this.getRiderProfile(userId);

    const eligibility = validateRiderEligibility({
      ...rider,
      activeDeliveryCount: rider.deliveries.length,
    });

    if (!eligibility.eligible) {
      throw new BadRequestError(`Rider is not eligible to accept delivery: ${eligibility.reason}`);
    }

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

    if (delivery.order.status !== "READY") {
      throw new BadRequestError("The associated order is not ready for delivery");
    }

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Atomically claim rider: ensure still available and no concurrent active deliveries
      const riderClaimResult = await tx.riderProfile.updateMany({
        where: {
          id: rider.id,
          status: "ACTIVE",
          isOnline: true,
          isAvailable: true,
          deliveries: {
            none: { status: { in: ["ASSIGNED", "OUT_FOR_DELIVERY"] } },
          },
        },
        data: { isAvailable: false },
      });

      if (riderClaimResult.count === 0) {
        throw new BadRequestError("Rider is not available to accept deliveries");
      }

      // 2. Atomically claim delivery: ensure still READY and unassigned
      const deliveryClaimResult = await tx.delivery.updateMany({
        where: {
          id: deliveryId,
          status: "READY",
          riderId: null,
        },
        data: {
          riderId: rider.id,
          status: "ASSIGNED",
          assignedAt: new Date(),
        },
      });

      if (deliveryClaimResult.count === 0) {
        // Release rider claim
        await tx.riderProfile.update({
          where: { id: rider.id },
          data: { isAvailable: true },
        });
        throw new BadRequestError("This delivery has already been assigned or is not available");
      }

      // 3. Fetch assigned delivery record
      const d = await tx.delivery.findUniqueOrThrow({
        where: { id: deliveryId },
        include: {
          order: {
            include: { restaurant: true },
          },
        },
      });

      // 4. Create Assignment Event
      await tx.deliveryAssignmentEvent.create({
        data: {
          deliveryId,
          riderId: rider.id,
          type: "ASSIGNED",
        },
      });

      // 5. Update order status history
      await tx.orderStatusHistory.create({
        data: {
          orderId: delivery.orderId,
          fromStatus: delivery.order.status,
          toStatus: "ASSIGNED",
          reason: `Assigned to rider ${rider.firstName} ${rider.lastName}`,
          actorUserId: userId,
        },
      });

      // 6. Update order status
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

      // Availability restoration symmetry: restore availability only if no other active deliveries remain
      const remainingActiveCount = await tx.delivery.count({
        where: {
          riderId: rider.id,
          id: { not: deliveryId },
          status: { in: ["ASSIGNED", "OUT_FOR_DELIVERY"] },
        },
      });

      if (remainingActiveCount === 0) {
        const shouldRestoreAvailable =
          rider.isOnline !== false && (!rider.status || rider.status === "ACTIVE");
        await tx.riderProfile.update({
          where: { id: rider.id },
          data: {
            isAvailable: shouldRestoreAvailable,
          },
        });
      }

      return d;
    });

    return serializeDelivery(updated);
  }

  async trackDelivery(
    orderId: string,
    userId: string,
    userRole: string
  ): Promise<DeliveryTrackingResponseDto> {
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

    if (userRole === "CUSTOMER") {
      const customerProfile = await prisma.customerProfile.findUnique({ where: { userId } });
      if (!customerProfile || order.customerId !== customerProfile.id) {
        throw new ForbiddenError("You are not authorized to track this order");
      }
    } else if (userRole === "RIDER") {
      const riderProfile = await prisma.riderProfile.findUnique({ where: { userId } });
      if (!riderProfile || order.delivery?.riderId !== riderProfile.id) {
        throw new ForbiddenError("You can only track deliveries assigned to you");
      }
    } else if (userRole === "RESTAURANT_STAFF") {
      const membership = await prisma.restaurantStaffMembership.findFirst({
        where: {
          userId,
          restaurantId: order.restaurantId,
          status: "ACTIVE",
        },
      });
      if (!membership) {
        throw new ForbiddenError("You are not authorized to track orders for this restaurant");
      }
    } else if (userRole !== "ADMIN") {
      throw new ForbiddenError("Your role is not authorized to track deliveries");
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

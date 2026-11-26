import { prisma } from "../../database/prisma.js";
import type { OrderWhereInput } from "../../generated/prisma/models.js";
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
} from "../../common/errors/api-error.js";
import {
  formatCurrency,
  calculatePlatformFee,
  calculateDeliveryFee,
} from "../../utils/money.js";
import { googleMapsService } from "../../integrations/google-maps/google-maps.service.js";
import type {
  CheckoutRequestDto,
  CancelOrderRequestDto,
  RejectOrderRequestDto,
  ListOrdersQueryDto,
  OrderResponseDto,
} from "./dto/order.dto.js";

interface OrderRecord {
  id: string;
  orderNumber: string;
  restaurantId: string;
  customerId: string;
  status: string;
  subtotal: unknown;
  deliveryFee: unknown;
  totalAmount: unknown;
  deliveryAddressText: string;
  deliveryDistanceKm?: unknown;
  items?: Array<{
    id: string;
    itemName: string;
    unitPrice: unknown;
    quantity: number;
    lineTotal: unknown;
  }>;
  statusHistory?: Array<{
    id: string;
    fromStatus?: string | null;
    toStatus: string;
    reason?: string | null;
    createdAt: Date;
  }>;
  restaurant?: { name: string } | null;
  payment?: { status: string } | null;
  rejectionReason?: string | null;
  cancelledReason?: string | null;
  createdAt: Date;
}

function serializeOrder(order: OrderRecord): OrderResponseDto {
  const subtotalMinor = Math.round(Number(order.subtotal) * 100);
  const deliveryFeeMinor = Math.round(Number(order.deliveryFee) * 100);
  const totalAmountMinor = Math.round(Number(order.totalAmount) * 100);

  const items = (order.items || []).map((item) => {
    const unitPriceMinor = Math.round(Number(item.unitPrice) * 100);
    const lineTotalMinor = Math.round(Number(item.lineTotal) * 100);
    return {
      id: item.id,
      itemName: item.itemName,
      unitPriceMinor,
      unitPriceFormatted: formatCurrency(unitPriceMinor),
      quantity: item.quantity,
      lineTotalMinor,
      lineTotalFormatted: formatCurrency(lineTotalMinor),
    };
  });

  const statusHistory = (order.statusHistory || []).map((sh) => ({
    id: sh.id,
    fromStatus: sh.fromStatus,
    toStatus: sh.toStatus,
    reason: sh.reason,
    createdAt: sh.createdAt.toISOString(),
  }));

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    restaurantId: order.restaurantId,
    restaurantName: order.restaurant?.name || "Restaurant",
    customerId: order.customerId,
    status: order.status,
    subtotalMinor,
    subtotalFormatted: formatCurrency(subtotalMinor),
    deliveryFeeMinor,
    deliveryFeeFormatted: formatCurrency(deliveryFeeMinor),
    totalAmountMinor,
    totalAmountFormatted: formatCurrency(totalAmountMinor),
    deliveryAddressText: order.deliveryAddressText,
    deliveryDistanceKm: order.deliveryDistanceKm ? Number(order.deliveryDistanceKm) : null,
    items,
    statusHistory,
    paymentStatus: order.payment?.status,
    rejectionReason: order.rejectionReason,
    cancelledReason: order.cancelledReason,
    createdAt: order.createdAt.toISOString(),
  };
}

export class OrdersService {
  async checkout(userId: string, dto: CheckoutRequestDto): Promise<OrderResponseDto> {
    const profile = await prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundError("Customer profile not found");
    }

    // Check idempotency if key provided
    if (dto.idempotencyKey) {
      const existing = await prisma.order.findUnique({
        where: { checkoutRequestKey: dto.idempotencyKey },
        include: { items: true, restaurant: true, payment: true, statusHistory: true },
      });
      if (existing) {
        return serializeOrder(existing);
      }
    }

    const cart = await prisma.cart.findUnique({
      where: { customerId: profile.id },
      include: {
        items: {
          include: { menuItem: true },
        },
      },
    });

    if (!cart || cart.items.length === 0 || !cart.restaurantId) {
      throw new BadRequestError("Cannot checkout with an empty cart");
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: cart.restaurantId },
    });

    if (!restaurant) {
      throw new NotFoundError("Restaurant not found");
    }

    if (restaurant.status !== "ACTIVE" || restaurant.availability !== "OPEN") {
      throw new BadRequestError("This restaurant is currently closed or not accepting orders");
    }

    const address = await prisma.address.findUnique({
      where: { id: dto.addressId },
    });

    if (!address || address.customerId !== profile.id) {
      throw new NotFoundError("Delivery address not found");
    }

    // Distance and delivery fee calculations via Google Maps Routes API (or fallback)
    const route = await googleMapsService.calculateRoute(
      { latitude: Number(restaurant.latitude), longitude: Number(restaurant.longitude) },
      { latitude: Number(address.latitude), longitude: Number(address.longitude) }
    );
    const distanceKm = route.distanceKm;

    if (distanceKm > Number(restaurant.maxDeliveryDistanceKm)) {
      throw new BadRequestError(
        `Delivery address is ${distanceKm}km away, which exceeds the restaurant limit of ${restaurant.maxDeliveryDistanceKm}km`
      );
    }

    const deliveryFeeMinor = calculateDeliveryFee(distanceKm);
    let subtotalMinor = 0;

    for (const item of cart.items) {
      if (item.menuItem.availability !== "AVAILABLE" || item.menuItem.isArchived) {
        throw new BadRequestError(
          `Item "${item.menuItem.name}" is no longer available. Please update your cart.`
        );
      }
      const itemPriceMinor = Math.round(Number(item.menuItem.price) * 100);
      subtotalMinor += itemPriceMinor * item.quantity;
    }

    const platformFeeMinor = calculatePlatformFee(subtotalMinor);
    const totalAmountMinor = subtotalMinor + deliveryFeeMinor + platformFeeMinor;

    // Platform commissions
    const restaurantCommissionMinor = Math.round(subtotalMinor * 0.15); // 15% commission
    const deliveryCommissionMinor = Math.round(deliveryFeeMinor * 0.20); // 20% delivery commission

    const orderNumber = `CHV-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

    const order = await prisma.$transaction(async (tx) => {
      const createdOrder = await tx.order.create({
        data: {
          orderNumber,
          checkoutRequestKey: dto.idempotencyKey ?? null,
          customerId: profile.id,
          restaurantId: restaurant.id,
          addressId: address.id,
          status: "PENDING_PAYMENT",
          subtotal: subtotalMinor / 100,
          deliveryFee: deliveryFeeMinor / 100,
          totalAmount: totalAmountMinor / 100,
          restaurantCommission: restaurantCommissionMinor / 100,
          deliveryCommission: deliveryCommissionMinor / 100,
          deliveryDistanceKm: distanceKm,
          deliveryAddressText: address.addressText,
          deliveryLatitude: address.latitude,
          deliveryLongitude: address.longitude,
          items: {
            create: cart.items.map((it) => ({
              menuItemId: it.menuItemId,
              itemName: it.menuItem.name,
              unitPrice: it.menuItem.price,
              quantity: it.quantity,
              lineTotal: Number(it.menuItem.price) * it.quantity,
            })),
          },
          statusHistory: {
            create: {
              toStatus: "PENDING_PAYMENT",
              note: dto.notes ?? null,
              actorUserId: userId,
            },
          },
        },
        include: {
          items: true,
          restaurant: true,
          statusHistory: true,
        },
      });

      // Clear the customer's cart
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      await tx.cart.update({
        where: { id: cart.id },
        data: { restaurantId: null },
      });

      return createdOrder;
    });

    return serializeOrder(order);
  }

  async list(
    userId: string,
    userRole: string,
    query: ListOrdersQueryDto
  ): Promise<{ items: OrderResponseDto[]; total: number; page: number; limit: number; totalPages: number }> {
    const where: OrderWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (userRole === "CUSTOMER") {
      const profile = await prisma.customerProfile.findUnique({ where: { userId } });
      if (!profile) return { items: [], total: 0, page: query.page, limit: query.limit, totalPages: 1 };
      where.customerId = profile.id;
    } else if (userRole === "RIDER") {
      const riderProfile = await prisma.riderProfile.findUnique({ where: { userId } });
      if (!riderProfile) {
        return { items: [], total: 0, page: query.page, limit: query.limit, totalPages: 1 };
      }
      where.delivery = { is: { riderId: riderProfile.id } };
    } else if (userRole === "RESTAURANT_STAFF") {
      const memberships = await prisma.restaurantStaffMembership.findMany({
        where: { userId, status: "ACTIVE" },
      });
      const allowedRestaurantIds = memberships.map((m) => m.restaurantId);
      if (query.restaurantId) {
        if (!allowedRestaurantIds.includes(query.restaurantId)) {
          throw new ForbiddenError("You are not authorized to list orders for this restaurant");
        }
        where.restaurantId = query.restaurantId;
      } else {
        where.restaurantId = { in: allowedRestaurantIds };
      }
    } else if (userRole === "ADMIN") {
      if (query.restaurantId) {
        where.restaurantId = query.restaurantId;
      }
    } else {
      throw new ForbiddenError("Your account role is not authorized to list orders");
    }

    const [total, orders] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        include: {
          items: true,
          restaurant: true,
          payment: true,
          statusHistory: true,
        },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return {
      items: orders.map(serializeOrder),
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit) || 1,
    };
  }

  async getById(userId: string, userRole: string, orderId: string): Promise<OrderResponseDto> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        restaurant: true,
        payment: true,
        delivery: true,
        statusHistory: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!order) {
      throw new NotFoundError("Order not found");
    }

    if (userRole === "CUSTOMER") {
      const profile = await prisma.customerProfile.findUnique({ where: { userId } });
      if (!profile || order.customerId !== profile.id) {
        throw new ForbiddenError("You cannot view this order");
      }
    } else if (userRole === "RIDER") {
      const riderProfile = await prisma.riderProfile.findUnique({ where: { userId } });
      if (!riderProfile || order.delivery?.riderId !== riderProfile.id) {
        throw new ForbiddenError("You cannot view an order not assigned to you");
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
        throw new ForbiddenError("You are not authorized to view orders for this restaurant");
      }
    } else if (userRole !== "ADMIN") {
      throw new ForbiddenError("You are not authorized to view this order");
    }

    return serializeOrder(order);
  }

  async cancelOrder(
    userId: string,
    userRole: string,
    orderId: string,
    dto: CancelOrderRequestDto
  ): Promise<OrderResponseDto> {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundError("Order not found");
    }

    if (userRole === "CUSTOMER") {
      const profile = await prisma.customerProfile.findUnique({ where: { userId } });
      if (!profile || order.customerId !== profile.id) {
        throw new ForbiddenError("You are not authorized to cancel another customer's order");
      }
    } else if (userRole !== "ADMIN") {
      throw new ForbiddenError("Only the ordering customer or an administrator can cancel this order");
    }

    if (order.status !== "PENDING_PAYMENT" && order.status !== "PENDING" && order.status !== "CONFIRMED") {
      throw new BadRequestError(
        `Order cannot be cancelled in status: ${order.status}. Orders can only be cancelled before preparation begins.`
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: "CANCELLED",
          reason: dto.reason,
          actorUserId: userId,
        },
      });

      return tx.order.update({
        where: { id: orderId },
        data: {
          status: "CANCELLED",
          cancelledReason: dto.reason,
          cancelledAt: new Date(),
        },
        include: {
          items: true,
          restaurant: true,
          payment: true,
          statusHistory: true,
        },
      });
    });

    return serializeOrder(updated);
  }

  async acceptOrder(userId: string, orderId: string): Promise<OrderResponseDto> {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundError("Order not found");

    if (order.status !== "CONFIRMED" && order.status !== "PENDING") {
      throw new BadRequestError(`Order in status ${order.status} cannot be accepted`);
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: "PREPARING",
          actorUserId: userId,
        },
      });

      return tx.order.update({
        where: { id: orderId },
        data: { status: "PREPARING" },
        include: { items: true, restaurant: true, payment: true, statusHistory: true },
      });
    });

    return serializeOrder(updated);
  }

  async markOrderReady(userId: string, orderId: string): Promise<OrderResponseDto> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { delivery: true },
    });
    if (!order) throw new NotFoundError("Order not found");

    if (order.status !== "PREPARING") {
      throw new BadRequestError(`Order in status ${order.status} cannot be marked ready`);
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: "READY",
          actorUserId: userId,
        },
      });

      // Update Delivery record status from PENDING to READY
      await tx.delivery.updateMany({
        where: { orderId },
        data: { status: "READY" },
      });

      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: "READY" },
        include: {
          items: true,
          restaurant: true,
          payment: true,
          statusHistory: true,
          delivery: true,
        },
      });

      // Schedule delivery dispatch via Transactional Outbox
      if (updatedOrder.delivery) {
        await tx.outboxEvent.create({
          data: {
            eventType: "DISPATCH_DELIVERY",
            aggregateType: "DELIVERY",
            aggregateId: updatedOrder.delivery.id,
            payload: {
              deliveryId: updatedOrder.delivery.id,
              orderId,
            },
            status: "PENDING",
          },
        });
      }

      return updatedOrder;
    });

    try {
      const { outboxDispatcher } = await import("../../jobs/outbox/outbox.dispatcher.js");
      await outboxDispatcher.dispatchPendingEvents();
    } catch {
      // Safe: outbox record is already durably committed to PostgreSQL
    }

    return serializeOrder(updated);
  }

  async rejectOrder(
    userId: string,
    orderId: string,
    dto: RejectOrderRequestDto
  ): Promise<OrderResponseDto> {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundError("Order not found");

    if (order.status !== "CONFIRMED" && order.status !== "PENDING") {
      throw new BadRequestError(`Order in status ${order.status} cannot be rejected`);
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: "REJECTED",
          reason: dto.reason,
          note: dto.note ?? null,
          actorUserId: userId,
        },
      });

      return tx.order.update({
        where: { id: orderId },
        data: {
          status: "REJECTED",
          rejectionReason: dto.reason,
          rejectionNote: dto.note ?? null,
          rejectedAt: new Date(),
        },
        include: { items: true, restaurant: true, payment: true, statusHistory: true },
      });
    });

    return serializeOrder(updated);
  }
}

export const ordersService = new OrdersService();

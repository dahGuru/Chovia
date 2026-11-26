import { prisma } from "../../database/prisma.js";
import type { AuditLogWhereInput } from "../../generated/prisma/models.js";
import type { AuditAction } from "../../generated/prisma/enums.js";
import { NotFoundError } from "../../common/errors/api-error.js";
import { formatCurrency } from "../../utils/money.js";
import type {
  UpdateRestaurantStatusDto,
  UpdateRiderStatusByAdminDto,
  ListAuditLogsQueryDto,
  PlatformMetricsResponseDto,
  AuditLogResponseDto,
} from "./dto/admin.dto.js";

export class AdminService {
  async getMetrics(): Promise<PlatformMetricsResponseDto> {
    const [
      totalUsers,
      customers,
      riders,
      restaurantStaff,
      totalRestaurants,
      activeRestaurants,
      pendingRestaurants,
      totalOrders,
      deliveredOrders,
      cancelledOrders,
      pendingOrders,
      revenueAggregate,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: "CUSTOMER" } }),
      prisma.user.count({ where: { role: "RIDER" } }),
      prisma.user.count({ where: { role: "RESTAURANT_STAFF" } }),
      prisma.restaurant.count(),
      prisma.restaurant.count({ where: { status: "ACTIVE" } }),
      prisma.restaurant.count({ where: { status: "PENDING_APPROVAL" } }),
      prisma.order.count(),
      prisma.order.count({ where: { status: "DELIVERED" } }),
      prisma.order.count({ where: { status: "CANCELLED" } }),
      prisma.order.count({ where: { status: "PENDING_PAYMENT" } }),
      prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: { status: "DELIVERED" },
      }),
    ]);

    const gmvMinor = Math.round(Number(revenueAggregate._sum.totalAmount || 0) * 100);

    return {
      users: {
        total: totalUsers,
        customers,
        riders,
        restaurantStaff,
      },
      restaurants: {
        total: totalRestaurants,
        active: activeRestaurants,
        pendingApproval: pendingRestaurants,
      },
      orders: {
        total: totalOrders,
        delivered: deliveredOrders,
        cancelled: cancelledOrders,
        pending: pendingOrders,
        gmvMinor,
        gmvFormatted: formatCurrency(gmvMinor),
      },
    };
  }

  async updateRestaurantStatus(
    adminUserId: string,
    restaurantId: string,
    dto: UpdateRestaurantStatusDto
  ): Promise<{ status: string }> {
    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!restaurant) throw new NotFoundError("Restaurant not found");

    const updateData: Record<string, unknown> = {
      status: dto.status,
    };

    if (dto.status === "ACTIVE") {
      updateData.approvedAt = new Date();
      updateData.approvedBy = adminUserId;
      updateData.availability = "OPEN";
    } else if (dto.status === "SUSPENDED") {
      updateData.suspendedAt = new Date();
      updateData.suspendedBy = adminUserId;
      updateData.availability = "CLOSED";
    }

    const updated = await prisma.$transaction(async (tx) => {
      const rest = await tx.restaurant.update({
        where: { id: restaurantId },
        data: updateData as Parameters<typeof tx.restaurant.update>[0]["data"],
      });

      await tx.auditLog.create({
        data: {
          actorUserId: adminUserId,
          action: dto.status === "ACTIVE" ? "APPROVE" : dto.status === "SUSPENDED" ? "SUSPEND" : "REJECT",
          entityType: "Restaurant",
          entityId: restaurantId,
          metadata: { status: dto.status, reason: dto.reason },
        },
      });

      return rest;
    });

    return { status: updated.status };
  }

  async updateRiderStatus(
    adminUserId: string,
    riderId: string,
    dto: UpdateRiderStatusByAdminDto
  ): Promise<{ status: string }> {
    const rider = await prisma.riderProfile.findUnique({ where: { id: riderId } });
    if (!rider) throw new NotFoundError("Rider not found");

    const updated = await prisma.$transaction(async (tx) => {
      const r = await tx.riderProfile.update({
        where: { id: riderId },
        data: {
          status: dto.status,
          ...(dto.status !== "ACTIVE" ? { isOnline: false, isAvailable: false } : {}),
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: adminUserId,
          action: dto.status === "ACTIVE" ? "APPROVE" : dto.status === "SUSPENDED" ? "SUSPEND" : "UPDATE",
          entityType: "RiderProfile",
          entityId: riderId,
          metadata: { status: dto.status, reason: dto.reason },
        },
      });

      return r;
    });

    return { status: updated.status };
  }

  async listAuditLogs(
    query: ListAuditLogsQueryDto
  ): Promise<{ items: AuditLogResponseDto[]; total: number; page: number; limit: number; totalPages: number }> {
    const where: AuditLogWhereInput = {};
    if (query.entityType) where.entityType = query.entityType;
    if (query.entityId) where.entityId = query.entityId;
    if (query.action) where.action = query.action as AuditAction;

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        include: { actor: true },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const items = logs.map((l) => ({
      id: l.id,
      actorUserId: l.actorUserId,
      actorName: l.actor?.name || null,
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId,
      metadata: l.metadata,
      createdAt: l.createdAt.toISOString(),
    }));

    return {
      items,
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit) || 1,
    };
  }
}

export const adminService = new AdminService();

import { z } from "zod";

export const updateRestaurantStatusSchema = z
  .object({
    status: z.enum(["PENDING_APPROVAL", "ACTIVE", "REJECTED", "SUSPENDED"]),
    reason: z.string().max(255).optional(),
  })
  .strict();

export type UpdateRestaurantStatusDto = z.infer<typeof updateRestaurantStatusSchema>;

export const updateRiderStatusByAdminSchema = z
  .object({
    status: z.enum(["PENDING", "ACTIVE", "SUSPENDED", "DEACTIVATED"]),
    reason: z.string().max(255).optional(),
  })
  .strict();

export type UpdateRiderStatusByAdminDto = z.infer<typeof updateRiderStatusByAdminSchema>;

export const listAuditLogsQuerySchema = z.object({
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  action: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type ListAuditLogsQueryDto = z.infer<typeof listAuditLogsQuerySchema>;

export const platformMetricsResponseSchema = z
  .object({
    users: z.object({
      total: z.number().int(),
      customers: z.number().int(),
      riders: z.number().int(),
      restaurantStaff: z.number().int(),
    }),
    restaurants: z.object({
      total: z.number().int(),
      active: z.number().int(),
      pendingApproval: z.number().int(),
    }),
    orders: z.object({
      total: z.number().int(),
      delivered: z.number().int(),
      cancelled: z.number().int(),
      pending: z.number().int(),
      gmvMinor: z.number().int(),
      gmvFormatted: z.string(),
    }),
  })
  .strict();

export type PlatformMetricsResponseDto = z.infer<typeof platformMetricsResponseSchema>;

export const auditLogResponseSchema = z
  .object({
    id: z.string().uuid(),
    actorUserId: z.string().nullable().optional(),
    actorName: z.string().nullable().optional(),
    action: z.string(),
    entityType: z.string(),
    entityId: z.string().nullable().optional(),
    metadata: z.any().optional(),
    createdAt: z.string(),
  })
  .strict();

export type AuditLogResponseDto = z.infer<typeof auditLogResponseSchema>;

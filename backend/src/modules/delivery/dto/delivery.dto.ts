import { z } from "zod";
import { GEOSPATIAL_CONSTRAINTS } from "@chovia/validation";

export const updateRiderStatusSchema = z
  .object({
    isOnline: z.boolean().optional(),
    status: z.enum(["ACTIVE", "DEACTIVATED"]).optional(),
    latitude: z
      .number()
      .min(GEOSPATIAL_CONSTRAINTS.latitude.min)
      .max(GEOSPATIAL_CONSTRAINTS.latitude.max)
      .optional(),
    longitude: z
      .number()
      .min(GEOSPATIAL_CONSTRAINTS.longitude.min)
      .max(GEOSPATIAL_CONSTRAINTS.longitude.max)
      .optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (val.isOnline === undefined && val.status === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["isOnline"],
        message: "Either isOnline (boolean) or status must be provided",
      });
    }
  });

export type UpdateRiderStatusDto = z.infer<typeof updateRiderStatusSchema>;

export const updateRiderLocationSchema = z
  .object({
    latitude: z
      .number()
      .min(GEOSPATIAL_CONSTRAINTS.latitude.min)
      .max(GEOSPATIAL_CONSTRAINTS.latitude.max),
    longitude: z
      .number()
      .min(GEOSPATIAL_CONSTRAINTS.longitude.min)
      .max(GEOSPATIAL_CONSTRAINTS.longitude.max),
  })
  .strict();

export type UpdateRiderLocationDto = z.infer<typeof updateRiderLocationSchema>;

export const riderStatusResponseSchema = z
  .object({
    status: z.enum(["PENDING", "ACTIVE", "SUSPENDED", "DEACTIVATED"]),
    isOnline: z.boolean(),
    isAvailable: z.boolean(),
    lastLatitude: z.number().nullable().optional(),
    lastLongitude: z.number().nullable().optional(),
    lastLocationUpdatedAt: z.string().nullable().optional(),
  })
  .strict();

export type RiderStatusResponseDto = z.infer<typeof riderStatusResponseSchema>;

export const riderSessionProfileResponseSchema = z
  .object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    firstName: z.string(),
    lastName: z.string(),
    status: z.enum(["PENDING", "ACTIVE", "SUSPENDED", "DEACTIVATED"]),
    isOnline: z.boolean(),
    isAvailable: z.boolean(),
    operatingCity: z.string().nullable().optional(),
    vehicleType: z.string().nullable().optional(),
    vehiclePlateNumber: z.string().nullable().optional(),
    lastLatitude: z.number().nullable().optional(),
    lastLongitude: z.number().nullable().optional(),
    lastLocationUpdatedAt: z.string().nullable().optional(),
    kycStatus: z.enum(["NOT_SUBMITTED", "PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED"]),
    kycRejectionReason: z.string().nullable().optional(),
    activeDeliveryCount: z.number().int().nonnegative(),
  })
  .strict();

export type RiderSessionProfileResponseDto = z.infer<typeof riderSessionProfileResponseSchema>;

export const deliveryResponseSchema = z
  .object({
    id: z.string().uuid(),
    orderId: z.string().uuid(),
    orderNumber: z.string(),
    restaurantName: z.string(),
    restaurantAddress: z.string(),
    deliveryAddressText: z.string(),
    distanceKm: z.number().nullable().optional(),
    riderEarningsMinor: z.number().int(),
    riderEarningsFormatted: z.string(),
    status: z.string(),
    assignedAt: z.string().nullable().optional(),
    pickedUpAt: z.string().nullable().optional(),
    deliveredAt: z.string().nullable().optional(),
    createdAt: z.string(),
  })
  .strict();

export type DeliveryResponseDto = z.infer<typeof deliveryResponseSchema>;

export const listRiderDeliveryHistoryQuerySchema = z.object({
  status: z.enum(["ASSIGNED", "OUT_FOR_DELIVERY", "DELIVERED"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
});

export type ListRiderDeliveryHistoryQueryDto = z.infer<typeof listRiderDeliveryHistoryQuerySchema>;

export const paginatedRiderDeliveryHistorySchema = z
  .object({
    items: z.array(deliveryResponseSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    totalPages: z.number().int().nonnegative(),
    totalEarningsMinor: z.number().int().nonnegative(),
    totalEarningsFormatted: z.string(),
  })
  .strict();

export type PaginatedRiderDeliveryHistoryDto = z.infer<typeof paginatedRiderDeliveryHistorySchema>;

export const deliveryTrackingResponseSchema = z
  .object({
    orderId: z.string().uuid(),
    orderNumber: z.string(),
    deliveryStatus: z.string(),
    restaurant: z.object({
      name: z.string(),
      address: z.string(),
      latitude: z.number(),
      longitude: z.number(),
    }),
    destination: z.object({
      addressText: z.string(),
      latitude: z.number(),
      longitude: z.number(),
    }),
    rider: z
      .object({
        name: z.string(),
        phone: z.string(),
        vehicleType: z.string().nullable().optional(),
        vehiclePlateNumber: z.string().nullable().optional(),
      })
      .nullable()
      .optional(),
    assignedAt: z.string().nullable().optional(),
    pickedUpAt: z.string().nullable().optional(),
    deliveredAt: z.string().nullable().optional(),
  })
  .strict();

export type DeliveryTrackingResponseDto = z.infer<typeof deliveryTrackingResponseSchema>;

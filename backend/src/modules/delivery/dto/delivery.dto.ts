import { z } from "zod";
import { GEOSPATIAL_CONSTRAINTS } from "@chovia/validation";

export const updateRiderStatusSchema = z
  .object({
    status: z.enum(["ACTIVE", "DEACTIVATED"]),
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
  .strict();

export type UpdateRiderStatusDto = z.infer<typeof updateRiderStatusSchema>;

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

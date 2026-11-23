import { z } from "zod";
import { GEOSPATIAL_CONSTRAINTS } from "@chovia/validation";

export const calculateEstimateRequestSchema = z
  .object({
    restaurantId: z.string().uuid("Invalid restaurantId"),
    addressId: z.string().uuid().optional(),
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
    items: z
      .array(
        z.object({
          menuItemId: z.string().uuid(),
          quantity: z.number().int().positive().max(50),
        })
      )
      .min(1, "At least one item required"),
  })
  .strict();

export type CalculateEstimateRequestDto = z.infer<typeof calculateEstimateRequestSchema>;

export const estimateResponseSchema = z
  .object({
    subtotalMinor: z.number().int(),
    subtotalFormatted: z.string(),
    deliveryFeeMinor: z.number().int(),
    deliveryFeeFormatted: z.string(),
    platformFeeMinor: z.number().int(),
    platformFeeFormatted: z.string(),
    totalMinor: z.number().int(),
    totalFormatted: z.string(),
    distanceKm: z.number().nullable().optional(),
  })
  .strict();

export type EstimateResponseDto = z.infer<typeof estimateResponseSchema>;

import { z } from "zod";
import { GEOSPATIAL_CONSTRAINTS, AUTH_CONSTRAINTS } from "@chovia/validation";

export const listRestaurantsQuerySchema = z.object({
  search: z.string().optional(),
  cuisineId: z.string().uuid().optional(),
  latitude: z.coerce
    .number()
    .min(GEOSPATIAL_CONSTRAINTS.latitude.min)
    .max(GEOSPATIAL_CONSTRAINTS.latitude.max)
    .optional(),
  longitude: z.coerce
    .number()
    .min(GEOSPATIAL_CONSTRAINTS.longitude.min)
    .max(GEOSPATIAL_CONSTRAINTS.longitude.max)
    .optional(),
  radiusKm: z.coerce.number().positive().max(50).default(10),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type ListRestaurantsQueryDto = z.infer<typeof listRestaurantsQuerySchema>;

export const createRestaurantRequestSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters").max(100).trim(),
    description: z.string().max(500).optional(),
    phone: z
      .string()
      .regex(AUTH_CONSTRAINTS.phone.pattern, AUTH_CONSTRAINTS.phone.message)
      .trim(),
    email: z.string().email().optional(),
    address: z.string().min(5, "Address must be at least 5 characters").max(255).trim(),
    latitude: z
      .number()
      .min(GEOSPATIAL_CONSTRAINTS.latitude.min)
      .max(GEOSPATIAL_CONSTRAINTS.latitude.max),
    longitude: z
      .number()
      .min(GEOSPATIAL_CONSTRAINTS.longitude.min)
      .max(GEOSPATIAL_CONSTRAINTS.longitude.max),
    maxDeliveryDistanceKm: z.number().positive().max(30).default(15),
    cuisineIds: z.array(z.string().uuid()).optional(),
  })
  .strict();

export type CreateRestaurantRequestDto = z.infer<typeof createRestaurantRequestSchema>;

export const updateRestaurantRequestSchema = z
  .object({
    name: z.string().min(2).max(100).optional(),
    description: z.string().max(500).optional(),
    phone: z
      .string()
      .regex(AUTH_CONSTRAINTS.phone.pattern, AUTH_CONSTRAINTS.phone.message)
      .optional(),
    email: z.string().email().optional(),
    address: z.string().min(5).max(255).optional(),
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
    maxDeliveryDistanceKm: z.number().positive().max(30).optional(),
  })
  .strict();

export type UpdateRestaurantRequestDto = z.infer<typeof updateRestaurantRequestSchema>;

export const updateAvailabilityRequestSchema = z
  .object({
    availability: z.enum(["OPEN", "CLOSED", "SUSPENDED"]),
    manualClosure: z.boolean().optional(),
  })
  .strict();

export type UpdateAvailabilityRequestDto = z.infer<typeof updateAvailabilityRequestSchema>;

export const restaurantResponseSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string().nullable().optional(),
    phone: z.string(),
    email: z.string().nullable().optional(),
    address: z.string(),
    latitude: z.number(),
    longitude: z.number(),
    maxDeliveryDistanceKm: z.number(),
    status: z.enum(["PENDING_APPROVAL", "ACTIVE", "REJECTED", "SUSPENDED"]),
    availability: z.enum(["OPEN", "CLOSED", "SUSPENDED"]),
    distanceKm: z.number().nullable().optional(),
    cuisines: z.array(z.string()).optional(),
    createdAt: z.string(),
  })
  .strict();

export type RestaurantResponseDto = z.infer<typeof restaurantResponseSchema>;

export const paginatedRestaurantsResponseSchema = z
  .object({
    items: z.array(restaurantResponseSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    totalPages: z.number().int().nonnegative(),
  })
  .strict();

export type PaginatedRestaurantsResponseDto = z.infer<typeof paginatedRestaurantsResponseSchema>;

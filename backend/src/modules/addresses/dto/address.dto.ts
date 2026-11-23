import { z } from "zod";
import { GEOSPATIAL_CONSTRAINTS } from "@chovia/validation";

export const createAddressRequestSchema = z
  .object({
    label: z.string().min(1, "Label is required (e.g. Home, Work)").max(50).trim(),
    addressText: z.string().min(5, "Address text must be at least 5 characters").max(255).trim(),
    latitude: z
      .number()
      .min(GEOSPATIAL_CONSTRAINTS.latitude.min)
      .max(GEOSPATIAL_CONSTRAINTS.latitude.max),
    longitude: z
      .number()
      .min(GEOSPATIAL_CONSTRAINTS.longitude.min)
      .max(GEOSPATIAL_CONSTRAINTS.longitude.max),
    isDefault: z.boolean().default(false),
  })
  .strict();

export type CreateAddressRequestDto = z.infer<typeof createAddressRequestSchema>;

export const updateAddressRequestSchema = z
  .object({
    label: z.string().min(1).max(50).optional(),
    addressText: z.string().min(5).max(255).optional(),
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
    isDefault: z.boolean().optional(),
  })
  .strict();

export type UpdateAddressRequestDto = z.infer<typeof updateAddressRequestSchema>;

export const addressResponseSchema = z
  .object({
    id: z.string().uuid(),
    label: z.string(),
    addressText: z.string(),
    latitude: z.number(),
    longitude: z.number(),
    isDefault: z.boolean(),
    createdAt: z.string(),
  })
  .strict();

export type AddressResponseDto = z.infer<typeof addressResponseSchema>;

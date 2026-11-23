import { z } from "zod";

export const createCategoryRequestSchema = z
  .object({
    name: z.string().min(1, "Category name is required").max(100).trim(),
    description: z.string().max(255).optional(),
    sortOrder: z.number().int().default(0),
  })
  .strict();

export type CreateCategoryRequestDto = z.infer<typeof createCategoryRequestSchema>;

export const updateCategoryRequestSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(255).optional(),
    sortOrder: z.number().int().optional(),
  })
  .strict();

export type UpdateCategoryRequestDto = z.infer<typeof updateCategoryRequestSchema>;

export const categoryResponseSchema = z
  .object({
    id: z.string().uuid(),
    restaurantId: z.string().uuid(),
    name: z.string(),
    description: z.string().nullable().optional(),
    sortOrder: z.number(),
    createdAt: z.string(),
  })
  .strict();

export type CategoryResponseDto = z.infer<typeof categoryResponseSchema>;

export const createMenuItemRequestSchema = z
  .object({
    categoryId: z.string().uuid("Invalid category ID"),
    name: z.string().min(1, "Item name is required").max(100).trim(),
    description: z.string().max(500).optional(),
    priceMinor: z.number().int().positive("Price must be greater than 0"),
    maxQuantity: z.number().int().min(1).max(50).default(10),
    imageUrl: z.string().url().optional(),
    availability: z.enum(["AVAILABLE", "UNAVAILABLE"]).default("AVAILABLE"),
  })
  .strict();

export type CreateMenuItemRequestDto = z.infer<typeof createMenuItemRequestSchema>;

export const updateMenuItemRequestSchema = z
  .object({
    categoryId: z.string().uuid().optional(),
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    priceMinor: z.number().int().positive().optional(),
    maxQuantity: z.number().int().min(1).max(50).optional(),
    imageUrl: z.string().url().optional(),
    availability: z.enum(["AVAILABLE", "UNAVAILABLE"]).optional(),
  })
  .strict();

export type UpdateMenuItemRequestDto = z.infer<typeof updateMenuItemRequestSchema>;

export const updateItemAvailabilityRequestSchema = z
  .object({
    availability: z.enum(["AVAILABLE", "UNAVAILABLE"]),
  })
  .strict();

export type UpdateItemAvailabilityRequestDto = z.infer<typeof updateItemAvailabilityRequestSchema>;

export const menuItemResponseSchema = z
  .object({
    id: z.string().uuid(),
    categoryId: z.string().uuid(),
    name: z.string(),
    description: z.string().nullable().optional(),
    priceMinor: z.number().int(),
    priceFormatted: z.string(),
    maxQuantity: z.number().int(),
    availability: z.enum(["AVAILABLE", "UNAVAILABLE"]),
    imageUrl: z.string().nullable().optional(),
    createdAt: z.string(),
  })
  .strict();

export type MenuItemResponseDto = z.infer<typeof menuItemResponseSchema>;

export const categoryWithItemsResponseSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string().nullable().optional(),
    sortOrder: z.number(),
    items: z.array(menuItemResponseSchema),
  })
  .strict();

export type CategoryWithItemsResponseDto = z.infer<typeof categoryWithItemsResponseSchema>;

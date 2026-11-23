import { z } from "zod";

export const addCartItemRequestSchema = z
  .object({
    menuItemId: z.string().uuid("Invalid menuItemId"),
    quantity: z.number().int().min(1, "Quantity must be at least 1").max(50).default(1),
    clearCartIfDifferentRestaurant: z.boolean().default(false),
  })
  .strict();

export type AddCartItemRequestDto = z.infer<typeof addCartItemRequestSchema>;

export const updateCartItemRequestSchema = z
  .object({
    quantity: z.number().int().min(1, "Quantity must be at least 1").max(50),
  })
  .strict();

export type UpdateCartItemRequestDto = z.infer<typeof updateCartItemRequestSchema>;

export const cartItemResponseSchema = z
  .object({
    id: z.string().uuid(),
    menuItemId: z.string().uuid(),
    name: z.string(),
    priceMinor: z.number().int(),
    priceFormatted: z.string(),
    quantity: z.number().int(),
    itemTotalMinor: z.number().int(),
    itemTotalFormatted: z.string(),
    imageUrl: z.string().nullable().optional(),
    availability: z.enum(["AVAILABLE", "UNAVAILABLE"]),
  })
  .strict();

export type CartItemResponseDto = z.infer<typeof cartItemResponseSchema>;

export const cartResponseSchema = z
  .object({
    id: z.string().uuid(),
    restaurantId: z.string().uuid().nullable().optional(),
    restaurantName: z.string().nullable().optional(),
    items: z.array(cartItemResponseSchema),
    itemCount: z.number().int(),
    pricing: z.object({
      currency: z.string(),
      subtotalMinor: z.number().int(),
      subtotalFormatted: z.string(),
      deliveryFeeMinor: z.number().int(),
      deliveryFeeFormatted: z.string(),
      platformFeeMinor: z.number().int(),
      platformFeeFormatted: z.string(),
      totalMinor: z.number().int(),
      totalFormatted: z.string(),
    }),
  })
  .strict();

export type CartResponseDto = z.infer<typeof cartResponseSchema>;

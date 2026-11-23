import { z } from "zod";

export const favoriteResponseSchema = z.object({
  id: z.string().uuid(),
  menuItemId: z.string().uuid(),
  name: z.string(),
  priceMinor: z.number().int(),
  priceFormatted: z.string(),
  imageUrl: z.string().nullable().optional(),
  restaurantId: z.string().uuid(),
  restaurantName: z.string(),
  createdAt: z.string(),
});

export type FavoriteResponseDto = z.infer<typeof favoriteResponseSchema>;

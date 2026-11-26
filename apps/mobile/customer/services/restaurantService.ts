import { z } from "zod";
import { ApiClientError, api } from "./api";

export const restaurantResponseSchema = z.object({
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
});

export type RestaurantResponseDto = z.infer<typeof restaurantResponseSchema>;

export const paginatedRestaurantsResponseSchema = z.object({
  items: z.array(restaurantResponseSchema),
  total: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
  totalPages: z.number().int(),
});

export type ListRestaurantsResponseDto = z.infer<typeof paginatedRestaurantsResponseSchema>;

export interface ListRestaurantsQuery {
  search?: string | undefined;
  cuisineId?: string | undefined;
  latitude?: number | undefined;
  longitude?: number | undefined;
  radiusKm?: number | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export const menuItemResponseSchema = z.object({
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
});

export type MenuItemResponseDto = z.infer<typeof menuItemResponseSchema>;

export const categoryWithItemsResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable().optional(),
  sortOrder: z.number().int(),
  items: z.array(menuItemResponseSchema),
});

export type CategoryWithItemsResponseDto = z.infer<typeof categoryWithItemsResponseSchema>;

export const menuResponseSchema = z.array(categoryWithItemsResponseSchema);

function formatSchemaIssue(issue: z.ZodIssue) {
  const base: {
    path: string;
    code: string;
    message: string;
    expected?: string;
    received?: string;
  } = {
    path: issue.path.length > 0 ? issue.path.join(".") : "<root>",
    code: issue.code,
    message: issue.message,
  };
  if ("expected" in issue && issue.expected !== undefined) {
    base.expected = String(issue.expected);
  }
  if ("received" in issue && issue.received !== undefined) {
    base.received = String(issue.received);
  }
  return base;
}

export function parseApiResponse<T>(
  endpoint: string,
  schema: z.ZodType<T>,
  payload: unknown
): T {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(formatSchemaIssue);
    if (typeof console !== "undefined" && typeof console.warn === "function") {
      console.warn("[API Schema Mismatch]", { endpoint, issues });
    }
    throw new ApiClientError(
      0,
      "RESPONSE_SCHEMA_ERROR",
      `Unexpected response format from ${endpoint}`,
      { endpoint, issues }
    );
  }
  return parsed.data;
}

export const restaurantService = {
  async list(query?: ListRestaurantsQuery): Promise<ListRestaurantsResponseDto> {
    const { data } = await api.get<unknown>("/restaurants", {
      params: query,
    });
    return parseApiResponse("GET /restaurants", paginatedRestaurantsResponseSchema, data);
  },

  async getById(
    id: string,
    coords?: { latitude: number; longitude: number }
  ): Promise<RestaurantResponseDto> {
    const { data } = await api.get<unknown>(`/restaurants/${id}`, {
      params: coords ? { lat: String(coords.latitude), lng: String(coords.longitude) } : undefined,
    });
    return parseApiResponse(`GET /restaurants/${id}`, restaurantResponseSchema, data);
  },

  async getMenu(restaurantId: string): Promise<CategoryWithItemsResponseDto[]> {
    const { data } = await api.get<unknown>(`/restaurants/${restaurantId}/menu`);
    return parseApiResponse(
      `GET /restaurants/${restaurantId}/menu`,
      menuResponseSchema,
      data
    );
  },
};

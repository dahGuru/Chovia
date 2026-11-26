import { api } from "./api";

export interface RestaurantResponseDto {
  id: string;
  name: string;
  description?: string | null;
  phone: string;
  email?: string | null;
  address: string;
  latitude: number;
  longitude: number;
  maxDeliveryDistanceKm: number;
  status: "PENDING_APPROVAL" | "ACTIVE" | "REJECTED" | "SUSPENDED";
  availability: "OPEN" | "CLOSED" | "SUSPENDED";
  distanceKm?: number;
  cuisines?: string[];
  createdAt: string;
}

export interface ListRestaurantsResponseDto {
  restaurants: RestaurantResponseDto[];
  total: number;
  page: number;
  limit: number;
}

export interface ListRestaurantsQuery {
  search?: string | undefined;
  cuisineId?: string | undefined;
  latitude?: number | undefined;
  longitude?: number | undefined;
  radiusKm?: number | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export interface MenuItemResponseDto {
  id: string;
  categoryId: string;
  name: string;
  description?: string | null;
  priceMinor: number;
  priceFormatted: string;
  maxQuantity: number;
  availability: "AVAILABLE" | "UNAVAILABLE";
  imageUrl?: string | null;
  createdAt: string;
}

export interface CategoryWithItemsResponseDto {
  id: string;
  name: string;
  description?: string | null;
  sortOrder: number;
  items: MenuItemResponseDto[];
}

export const restaurantService = {
  async list(query?: ListRestaurantsQuery): Promise<ListRestaurantsResponseDto> {
    const { data } = await api.get<ListRestaurantsResponseDto>("/restaurants", {
      params: query,
    });
    return data;
  },

  async getById(
    id: string,
    coords?: { latitude: number; longitude: number }
  ): Promise<RestaurantResponseDto> {
    const { data } = await api.get<RestaurantResponseDto>(`/restaurants/${id}`, {
      params: coords ? { lat: String(coords.latitude), lng: String(coords.longitude) } : undefined,
    });
    return data;
  },

  async getMenu(restaurantId: string): Promise<CategoryWithItemsResponseDto[]> {
    const { data } = await api.get<CategoryWithItemsResponseDto[]>(
      `/restaurants/${restaurantId}/menu`
    );
    return data;
  },
};

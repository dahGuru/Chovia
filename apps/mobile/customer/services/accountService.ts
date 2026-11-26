import { api } from "./api";
import type { UserResponseDto } from "./authService";

export interface UpdateUserRequestDto {
  firstName?: string;
  lastName?: string;
  phone?: string;
  image?: string;
}

export interface FavoriteResponseDto {
  id: string;
  menuItemId: string;
  name: string;
  priceMinor: number;
  priceFormatted: string;
  imageUrl?: string | null;
  restaurantId: string;
  restaurantName: string;
  createdAt: string;
}

export interface NotificationItemDto {
  id: string;
  title: string;
  body: string;
  type?: string;
  isRead: boolean;
  createdAt: string;
  data?: Record<string, unknown> | null;
}

export const accountService = {
  async getProfile(): Promise<UserResponseDto> {
    const { data } = await api.get<UserResponseDto>("/users/profile");
    return data;
  },

  async updateProfile(payload: UpdateUserRequestDto): Promise<UserResponseDto> {
    const { data } = await api.patch<UserResponseDto>("/users/profile", payload);
    return data;
  },

  async registerDevice(payload: {
    expoPushToken: string;
    deviceName?: string;
    platform: "ios" | "android" | "web";
  }): Promise<void> {
    await api.post("/users/devices", payload);
  },

  async listFavorites(): Promise<FavoriteResponseDto[]> {
    const { data } = await api.get<FavoriteResponseDto[]>("/favorites");
    return data;
  },

  async toggleFavorite(menuItemId: string): Promise<{ favorited: boolean }> {
    const { data } = await api.post<{ favorited: boolean }>(`/favorites/${menuItemId}`);
    return data;
  },

  async listNotifications(): Promise<NotificationItemDto[]> {
    const { data } = await api.get<NotificationItemDto[]>("/notifications");
    return data;
  },

  async markNotificationRead(id: string): Promise<void> {
    await api.patch(`/notifications/${id}/read`);
  },

  async markAllNotificationsRead(): Promise<void> {
    await api.patch("/notifications/read-all");
  },
};

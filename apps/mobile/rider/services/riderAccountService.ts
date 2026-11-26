import { api } from "./api";
import type { UserResponseDto } from "./authService";

export interface UpdateUserRequestDto {
  firstName?: string | undefined;
  lastName?: string | undefined;
  phone?: string | undefined;
  image?: string | undefined;
}

export interface NotificationItemDto {
  id: string;
  title: string;
  body: string;
  type?: string;
  isRead: boolean;
  createdAt: string;
}

export const riderAccountService = {
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

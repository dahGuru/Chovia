import { prisma } from "../../database/prisma.js";
import { NotFoundError, ConflictError } from "../../common/errors/api-error.js";
import type {
  UpdateUserRequestDto,
  RegisterDeviceRequestDto,
  DeviceResponseDto,
} from "./dto/user.dto.js";
import type { UserResponseDto } from "../auth/dto/auth.dto.js";

export class UsersService {
  async getProfile(userId: string): Promise<UserResponseDto> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    const parts = user.name.split(" ");
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      emailVerified: user.emailVerified,
      phoneVerified: false,
      firstName: parts[0] || "",
      lastName: parts.slice(1).join(" ") || "",
      phone: user.phone,
      createdAt: user.createdAt.toISOString(),
    };
  }

  async updateProfile(userId: string, dto: UpdateUserRequestDto): Promise<UserResponseDto> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    let fullName = user.name;
    if (dto.firstName !== undefined || dto.lastName !== undefined) {
      const parts = user.name.split(" ");
      const currentFirst = parts[0] || "";
      const currentLast = parts.slice(1).join(" ") || "";
      const first = dto.firstName ?? currentFirst;
      const last = dto.lastName ?? currentLast;
      fullName = `${first} ${last}`.trim();
    }

    if (dto.phone && dto.phone !== user.phone) {
      const existingPhone = await prisma.user.findUnique({
        where: { phone: dto.phone },
      });
      if (existingPhone && existingPhone.id !== userId) {
        throw new ConflictError("Phone number is already in use by another account");
      }
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        name: fullName,
        phone: dto.phone ?? user.phone,
        image: dto.image ?? user.image,
      },
    });

    const parts = updated.name.split(" ");
    return {
      id: updated.id,
      email: updated.email,
      role: updated.role,
      status: updated.status,
      emailVerified: updated.emailVerified,
      phoneVerified: false,
      firstName: parts[0] || "",
      lastName: parts.slice(1).join(" ") || "",
      phone: updated.phone,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  async registerDevice(userId: string, dto: RegisterDeviceRequestDto): Promise<DeviceResponseDto> {
    const device = await prisma.userDevice.upsert({
      where: {
        expoPushToken: dto.expoPushToken,
      },
      create: {
        userId,
        expoPushToken: dto.expoPushToken,
        deviceName: dto.deviceName ?? null,
        platform: dto.platform,
        isActive: true,
        lastSeenAt: new Date(),
      },
      update: {
        userId,
        deviceName: dto.deviceName ?? null,
        platform: dto.platform,
        isActive: true,
        lastSeenAt: new Date(),
      },
    });

    return {
      id: device.id,
      expoPushToken: device.expoPushToken,
      deviceName: device.deviceName,
      platform: device.platform,
      isActive: device.isActive,
      lastSeenAt: device.lastSeenAt?.toISOString() || null,
      createdAt: device.createdAt.toISOString(),
    };
  }

  async listDevices(userId: string): Promise<DeviceResponseDto[]> {
    const devices = await prisma.userDevice.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: "desc" },
    });

    return devices.map((d) => ({
      id: d.id,
      expoPushToken: d.expoPushToken,
      deviceName: d.deviceName,
      platform: d.platform,
      isActive: d.isActive,
      lastSeenAt: d.lastSeenAt?.toISOString() || null,
      createdAt: d.createdAt.toISOString(),
    }));
  }

  async deleteDevice(userId: string, deviceId: string): Promise<{ success: boolean }> {
    await prisma.userDevice.updateMany({
      where: { id: deviceId, userId },
      data: { isActive: false },
    });
    return { success: true };
  }
}

export const usersService = new UsersService();

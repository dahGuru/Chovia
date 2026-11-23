import { prisma } from "../../database/prisma.js";
import { NotFoundError } from "../../common/errors/api-error.js";
import type {
  CreateAddressRequestDto,
  UpdateAddressRequestDto,
  AddressResponseDto,
} from "./dto/address.dto.js";

interface AddressRecord {
  id: string;
  label: string;
  addressText: string;
  latitude: unknown;
  longitude: unknown;
  isDefault: boolean;
  createdAt: Date | string;
}

function serializeAddress(address: AddressRecord): AddressResponseDto {
  return {
    id: address.id,
    label: address.label,
    addressText: address.addressText,
    latitude: Number(address.latitude),
    longitude: Number(address.longitude),
    isDefault: address.isDefault,
    createdAt: address.createdAt instanceof Date ? address.createdAt.toISOString() : new Date(address.createdAt).toISOString(),
  };
}

export class AddressesService {
  private async getOrCreateCustomerId(userId: string): Promise<string> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const parts = (user?.name || "Customer").split(" ");
    const firstName = parts[0] || "Customer";
    const lastName = parts.slice(1).join(" ") || "Customer";

    const profile = await prisma.customerProfile.upsert({
      where: { userId },
      create: { userId, firstName, lastName },
      update: {},
    });
    return profile.id;
  }

  async list(userId: string): Promise<AddressResponseDto[]> {
    const customerId = await this.getOrCreateCustomerId(userId);
    const addresses = await prisma.address.findMany({
      where: { customerId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });

    return addresses.map(serializeAddress);
  }

  async create(userId: string, dto: CreateAddressRequestDto): Promise<AddressResponseDto> {
    const customerId = await this.getOrCreateCustomerId(userId);

    if (dto.isDefault) {
      await prisma.address.updateMany({
        where: { customerId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const rows = await prisma.$queryRaw<AddressRecord[]>`
      INSERT INTO addresses (id, "customerId", label, "addressText", latitude, longitude, location, "isDefault", "createdAt", "updatedAt")
      VALUES (
        gen_random_uuid(),
        ${customerId}::uuid,
        ${dto.label},
        ${dto.addressText},
        ${dto.latitude},
        ${dto.longitude},
        ST_SetSRID(ST_MakePoint(${dto.longitude}, ${dto.latitude}), 4326),
        ${dto.isDefault},
        NOW(),
        NOW()
      )
      RETURNING id, "customerId", label, "addressText", latitude, longitude, "isDefault", "createdAt", "updatedAt"
    `;

    const created = rows[0];
    if (!created) {
      throw new Error("Failed to insert address");
    }

    return serializeAddress(created);
  }

  async update(
    userId: string,
    addressId: string,
    dto: UpdateAddressRequestDto
  ): Promise<AddressResponseDto> {
    const customerId = await this.getOrCreateCustomerId(userId);
    const existing = await prisma.address.findUnique({
      where: { id: addressId },
    });

    if (!existing || existing.customerId !== customerId) {
      throw new NotFoundError("Address not found");
    }

    const updateData: Record<string, unknown> = {};
    if (dto.label !== undefined) updateData.label = dto.label;
    if (dto.addressText !== undefined) updateData.addressText = dto.addressText;
    if (dto.latitude !== undefined) updateData.latitude = dto.latitude;
    if (dto.longitude !== undefined) updateData.longitude = dto.longitude;
    if (dto.isDefault !== undefined) updateData.isDefault = dto.isDefault;

    const updated = await prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.address.updateMany({
          where: { customerId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.address.update({
        where: { id: addressId },
        data: updateData,
      });
    });

    return serializeAddress(updated);
  }

  async setDefault(userId: string, addressId: string): Promise<AddressResponseDto> {
    return this.update(userId, addressId, { isDefault: true });
  }

  async delete(userId: string, addressId: string): Promise<{ success: boolean }> {
    const customerId = await this.getOrCreateCustomerId(userId);
    const existing = await prisma.address.findUnique({
      where: { id: addressId },
    });

    if (!existing || existing.customerId !== customerId) {
      throw new NotFoundError("Address not found");
    }

    await prisma.address.delete({
      where: { id: addressId },
    });

    return { success: true };
  }
}

export const addressesService = new AddressesService();

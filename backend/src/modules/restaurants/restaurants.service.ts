import { prisma } from "../../database/prisma.js";
import type { RestaurantWhereInput } from "../../generated/prisma/models.js";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../common/errors/api-error.js";
import { calculateHaversineDistanceKm } from "../../utils/geo.js";
import type {
  ListRestaurantsQueryDto,
  CreateRestaurantRequestDto,
  UpdateRestaurantRequestDto,
  UpdateAvailabilityRequestDto,
  RestaurantResponseDto,
  PaginatedRestaurantsResponseDto,
} from "./dto/restaurant.dto.js";

interface RestaurantRecord {
  id: string;
  name: string;
  description?: string | null;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  phone: string;
  email?: string | null;
  address: string;
  latitude: unknown;
  longitude: unknown;
  maxDeliveryDistanceKm: unknown;
  status: "PENDING_APPROVAL" | "ACTIVE" | "REJECTED" | "SUSPENDED";
  availability: "OPEN" | "CLOSED" | "SUSPENDED";
  manualClosure?: boolean;
  rejectionReason?: string | null;
  cuisines?: Array<{
    cuisineCategory?: { name: string } | null;
    name?: string;
  }>;
  createdAt: Date | string;
}

function serializeRestaurant(
  restaurant: RestaurantRecord,
  userLocation?: { lat: number; lng: number }
): RestaurantResponseDto {
  const lat = Number(restaurant.latitude);
  const lng = Number(restaurant.longitude);

  let distanceKm: number | undefined;
  if (userLocation) {
    distanceKm = calculateHaversineDistanceKm(
      userLocation.lat,
      userLocation.lng,
      lat,
      lng
    );
  }

  const cuisines = restaurant.cuisines
    ? restaurant.cuisines
        .map((c) => c.cuisineCategory?.name || c.name)
        .filter((name): name is string => typeof name === "string")
    : [];

  return {
    id: restaurant.id,
    name: restaurant.name,
    description: restaurant.description ?? null,
    logoUrl: restaurant.logoUrl ?? null,
    coverImageUrl: restaurant.coverImageUrl ?? null,
    phone: restaurant.phone,
    email: restaurant.email ?? null,
    address: restaurant.address,
    latitude: lat,
    longitude: lng,
    maxDeliveryDistanceKm: Number(restaurant.maxDeliveryDistanceKm),
    status: restaurant.status,
    availability: restaurant.availability,
    ...(restaurant.manualClosure !== undefined ? { manualClosure: restaurant.manualClosure } : {}),
    rejectionReason: restaurant.rejectionReason ?? null,
    distanceKm,
    cuisines,
    createdAt:
      restaurant.createdAt instanceof Date
        ? restaurant.createdAt.toISOString()
        : new Date(restaurant.createdAt).toISOString(),
  };
}

export class RestaurantsService {
  async list(
    query: ListRestaurantsQueryDto
  ): Promise<PaginatedRestaurantsResponseDto> {
    const where: RestaurantWhereInput = {
      status: "ACTIVE",
    };

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: "insensitive" } },
        { description: { contains: query.search, mode: "insensitive" } },
        {
          cuisines: {
            some: {
              cuisineCategory: {
                name: { contains: query.search, mode: "insensitive" },
              },
            },
          },
        },
      ];
    }

    if (query.cuisineId) {
      where.cuisines = {
        some: { cuisineCategoryId: query.cuisineId },
      };
    }

    const userLoc =
      query.latitude !== undefined && query.longitude !== undefined
        ? { lat: query.latitude, lng: query.longitude }
        : undefined;

    if (userLoc && query.radiusKm) {
      const candidates = await prisma.restaurant.findMany({
        where,
        include: {
          cuisines: {
            include: { cuisineCategory: true },
          },
        },
        orderBy: { name: "asc" },
      });

      const filtered = candidates
        .map((r) => serializeRestaurant(r, userLoc))
        .filter((r) => r.distanceKm !== undefined && r.distanceKm !== null && r.distanceKm <= query.radiusKm);

      const total = filtered.length;
      const start = (query.page - 1) * query.limit;
      const items = filtered.slice(start, start + query.limit);

      return {
        items,
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit) || 1,
      };
    }

    const [total, rawRestaurants] = await Promise.all([
      prisma.restaurant.count({ where }),
      prisma.restaurant.findMany({
        where,
        include: {
          cuisines: {
            include: { cuisineCategory: true },
          },
        },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { name: "asc" },
      }),
    ]);

    const items = rawRestaurants.map((r) => serializeRestaurant(r, userLoc));

    return {
      items,
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit) || 1,
    };
  }

  async getById(id: string, userLocation?: { lat: number; lng: number }): Promise<RestaurantResponseDto> {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id },
      include: {
        cuisines: {
          include: { cuisineCategory: true },
        },
        operatingHours: true,
      },
    });

    if (!restaurant) {
      throw new NotFoundError("Restaurant not found");
    }

    return serializeRestaurant(restaurant, userLocation);
  }

  async listMine(userId: string, userRole: string): Promise<RestaurantResponseDto[]> {
    if (userRole !== "RESTAURANT_STAFF" && userRole !== "ADMIN") {
      throw new ForbiddenError("Only restaurant staff or administrators can access managed restaurants");
    }

    const memberships = await prisma.restaurantStaffMembership.findMany({
      where: {
        userId,
        status: "ACTIVE",
      },
      include: {
        restaurant: {
          include: {
            cuisines: {
              include: { cuisineCategory: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return memberships.map((m) => serializeRestaurant(m.restaurant));
  }

  async create(
    userId: string,
    userRole: string,
    dto: CreateRestaurantRequestDto
  ): Promise<RestaurantResponseDto> {
    if (userRole !== "RESTAURANT_STAFF" && userRole !== "ADMIN") {
      throw new ForbiddenError("Only restaurant partner accounts or administrators can register a restaurant");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, status: true },
    });

    if (!user || user.status !== "ACTIVE" || (user.role !== "RESTAURANT_STAFF" && user.role !== "ADMIN")) {
      throw new ForbiddenError("Account is not authorized to register a restaurant");
    }

    const created = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<RestaurantRecord[]>`
        INSERT INTO restaurants (id, name, description, phone, email, address, latitude, longitude, location, "maxDeliveryDistanceKm", status, availability, "manualClosure", "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid(),
          ${dto.name},
          ${dto.description ?? null},
          ${dto.phone},
          ${dto.email ?? null},
          ${dto.address},
          ${dto.latitude},
          ${dto.longitude},
          ST_SetSRID(ST_MakePoint(${dto.longitude}, ${dto.latitude}), 4326),
          ${dto.maxDeliveryDistanceKm},
          'PENDING_APPROVAL'::"RestaurantStatus",
          'CLOSED'::"RestaurantAvailability",
          false,
          NOW(),
          NOW()
        )
        RETURNING id, name, description, "logoUrl", "coverImageUrl", phone, email, address, latitude, longitude, "maxDeliveryDistanceKm", status, availability, "manualClosure", "rejectionReason", "createdAt", "updatedAt"
      `;

      const row = rows[0];
      if (!row) {
        throw new Error("Failed to insert restaurant");
      }

      await tx.restaurantStaffMembership.create({
        data: {
          userId,
          restaurantId: row.id,
          status: "ACTIVE",
        },
      });

      if (dto.cuisineIds?.length) {
        await tx.restaurantCuisine.createMany({
          data: dto.cuisineIds.map((cid) => ({
            restaurantId: row.id,
            cuisineCategoryId: cid,
          })),
        });
      }

      return tx.restaurant.findUniqueOrThrow({
        where: { id: row.id },
        include: {
          cuisines: {
            include: { cuisineCategory: true },
          },
        },
      });
    });

    return serializeRestaurant(created);
  }

  async update(id: string, dto: UpdateRestaurantRequestDto): Promise<RestaurantResponseDto> {
    const restaurant = await prisma.restaurant.findUnique({ where: { id } });
    if (!restaurant) {
      throw new NotFoundError("Restaurant not found");
    }

    const hasLat = dto.latitude !== undefined;
    const hasLng = dto.longitude !== undefined;
    if (hasLat !== hasLng) {
      throw new BadRequestError("Both latitude and longitude must be provided together when updating location");
    }

    const updateData: Record<string, unknown> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.logoUrl !== undefined) updateData.logoUrl = dto.logoUrl;
    if (dto.coverImageUrl !== undefined) updateData.coverImageUrl = dto.coverImageUrl;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.address !== undefined) updateData.address = dto.address;
    if (dto.latitude !== undefined) updateData.latitude = dto.latitude;
    if (dto.longitude !== undefined) updateData.longitude = dto.longitude;
    if (dto.maxDeliveryDistanceKm !== undefined) updateData.maxDeliveryDistanceKm = dto.maxDeliveryDistanceKm;

    const updated = await prisma.$transaction(async (tx) => {
      if (Object.keys(updateData).length > 0) {
        await tx.restaurant.update({
          where: { id },
          data: updateData as Parameters<typeof tx.restaurant.update>[0]["data"],
        });
      }

      if (dto.latitude !== undefined && dto.longitude !== undefined) {
        await tx.$executeRaw`
          UPDATE restaurants
          SET location = ST_SetSRID(ST_MakePoint(${dto.longitude}, ${dto.latitude}), 4326)
          WHERE id = ${id}::uuid
        `;
      }

      if (dto.cuisineIds !== undefined) {
        await tx.restaurantCuisine.deleteMany({
          where: { restaurantId: id },
        });
        if (dto.cuisineIds.length > 0) {
          await tx.restaurantCuisine.createMany({
            data: dto.cuisineIds.map((cuisineCategoryId) => ({
              restaurantId: id,
              cuisineCategoryId,
            })),
          });
        }
      }

      return tx.restaurant.findUniqueOrThrow({
        where: { id },
        include: {
          cuisines: {
            include: { cuisineCategory: true },
          },
        },
      });
    });

    return serializeRestaurant(updated);
  }

  async updateAvailability(id: string, dto: UpdateAvailabilityRequestDto): Promise<RestaurantResponseDto> {
    const restaurant = await prisma.restaurant.findUnique({ where: { id } });
    if (!restaurant) {
      throw new NotFoundError("Restaurant not found");
    }

    const updated = await prisma.restaurant.update({
      where: { id },
      data: {
        availability: dto.availability,
        manualClosure: dto.manualClosure ?? restaurant.manualClosure,
      },
    });

    return serializeRestaurant(updated);
  }
}

export const restaurantsService = new RestaurantsService();

import { prisma } from "../../database/prisma.js";
import type { RestaurantWhereInput } from "../../generated/prisma/models.js";
import { NotFoundError } from "../../common/errors/api-error.js";
import { calculateHaversineDistanceKm } from "../../utils/geo.js";
import type {
  ListRestaurantsQueryDto,
  CreateRestaurantRequestDto,
  UpdateRestaurantRequestDto,
  UpdateAvailabilityRequestDto,
  RestaurantResponseDto,
} from "./dto/restaurant.dto.js";

interface RestaurantRecord {
  id: string;
  name: string;
  description?: string | null;
  phone: string;
  email?: string | null;
  address: string;
  latitude: unknown;
  longitude: unknown;
  maxDeliveryDistanceKm: unknown;
  status: "PENDING_APPROVAL" | "ACTIVE" | "REJECTED" | "SUSPENDED";
  availability: "OPEN" | "CLOSED" | "SUSPENDED";
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
    description: restaurant.description,
    phone: restaurant.phone,
    email: restaurant.email,
    address: restaurant.address,
    latitude: lat,
    longitude: lng,
    maxDeliveryDistanceKm: Number(restaurant.maxDeliveryDistanceKm),
    status: restaurant.status,
    availability: restaurant.availability,
    distanceKm,
    cuisines,
    createdAt: restaurant.createdAt instanceof Date ? restaurant.createdAt.toISOString() : new Date(restaurant.createdAt).toISOString(),
  };
}

export class RestaurantsService {
  async list(
    query: ListRestaurantsQueryDto
  ): Promise<{ items: RestaurantResponseDto[]; total: number; page: number; limit: number; totalPages: number }> {
    const where: RestaurantWhereInput = {
      status: "ACTIVE",
    };

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: "insensitive" } },
        { description: { contains: query.search, mode: "insensitive" } },
      ];
    }

    if (query.cuisineId) {
      where.cuisines = {
        some: { cuisineCategoryId: query.cuisineId },
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

    const userLoc =
      query.latitude !== undefined && query.longitude !== undefined
        ? { lat: query.latitude, lng: query.longitude }
        : undefined;

    let items = rawRestaurants.map((r) => serializeRestaurant(r, userLoc));

    if (userLoc && query.radiusKm) {
      items = items.filter((r) => r.distanceKm !== undefined && r.distanceKm <= query.radiusKm);
    }

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

  async create(userId: string, dto: CreateRestaurantRequestDto): Promise<RestaurantResponseDto> {
    const rows = await prisma.$queryRaw<RestaurantRecord[]>`
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
      RETURNING id, name, description, phone, email, address, latitude, longitude, "maxDeliveryDistanceKm", status, availability, "manualClosure", "createdAt", "updatedAt"
    `;

    const created = rows[0];
    if (!created) {
      throw new Error("Failed to insert restaurant");
    }

    await prisma.restaurantStaffMembership.create({
      data: {
        userId,
        restaurantId: created.id,
        status: "ACTIVE",
      },
    });

    if (dto.cuisineIds?.length) {
      await prisma.restaurantCuisine.createMany({
        data: dto.cuisineIds.map((cid) => ({
          restaurantId: created.id,
          cuisineCategoryId: cid,
        })),
      });
    }

    return serializeRestaurant(created);
  }

  async update(id: string, dto: UpdateRestaurantRequestDto): Promise<RestaurantResponseDto> {
    const restaurant = await prisma.restaurant.findUnique({ where: { id } });
    if (!restaurant) {
      throw new NotFoundError("Restaurant not found");
    }

    const updateData: Record<string, unknown> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.address !== undefined) updateData.address = dto.address;
    if (dto.latitude !== undefined) updateData.latitude = dto.latitude;
    if (dto.longitude !== undefined) updateData.longitude = dto.longitude;
    if (dto.maxDeliveryDistanceKm !== undefined) updateData.maxDeliveryDistanceKm = dto.maxDeliveryDistanceKm;

    const updated = await prisma.restaurant.update({
      where: { id },
      data: updateData as Parameters<typeof prisma.restaurant.update>[0]["data"],
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

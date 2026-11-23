import { prisma } from "../../database/prisma.js";
import { NotFoundError } from "../../common/errors/api-error.js";
import { formatCurrency } from "../../utils/money.js";
import type { FavoriteResponseDto } from "./dto/favorite.dto.js";

export class FavoritesService {
  async toggleFavorite(userId: string, menuItemId: string): Promise<{ favorited: boolean }> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const parts = (user?.name || "Customer").split(" ");
    const firstName = parts[0] || "Customer";
    const lastName = parts.slice(1).join(" ") || "Customer";

    const profile = await prisma.customerProfile.upsert({
      where: { userId },
      create: { userId, firstName, lastName },
      update: {},
    });

    const item = await prisma.menuItem.findUnique({ where: { id: menuItemId } });
    if (!item) throw new NotFoundError("Menu item not found");

    const existing = await prisma.favorite.findUnique({
      where: {
        customerId_menuItemId: {
          customerId: profile.id,
          menuItemId,
        },
      },
    });

    if (existing) {
      await prisma.favorite.delete({ where: { id: existing.id } });
      return { favorited: false };
    }

    await prisma.favorite.create({
      data: {
        customerId: profile.id,
        menuItemId,
      },
    });

    return { favorited: true };
  }

  async list(userId: string): Promise<FavoriteResponseDto[]> {
    const profile = await prisma.customerProfile.findUnique({ where: { userId } });
    if (!profile) return [];

    const favorites = await prisma.favorite.findMany({
      where: { customerId: profile.id },
      include: {
        menuItem: {
          include: {
            category: { include: { restaurant: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return favorites.map((f) => {
      const priceMinor = Math.round(Number(f.menuItem.price) * 100);
      return {
        id: f.id,
        menuItemId: f.menuItemId,
        name: f.menuItem.name,
        priceMinor,
        priceFormatted: formatCurrency(priceMinor),
        imageUrl: f.menuItem.imageUrl,
        restaurantId: f.menuItem.category.restaurant.id,
        restaurantName: f.menuItem.category.restaurant.name,
        createdAt: f.createdAt.toISOString(),
      };
    });
  }
}

export const favoritesService = new FavoritesService();

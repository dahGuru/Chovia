import { prisma } from "../../database/prisma.js";
import { NotFoundError } from "../../common/errors/api-error.js";
import { formatCurrency } from "../../utils/money.js";
import type {
  CreateCategoryRequestDto,
  UpdateCategoryRequestDto,
  CategoryResponseDto,
  CreateMenuItemRequestDto,
  UpdateMenuItemRequestDto,
  MenuItemResponseDto,
  CategoryWithItemsResponseDto,
} from "./dto/menu.dto.js";

interface MenuItemRecord {
  id: string;
  categoryId: string;
  name: string;
  description?: string | null;
  price: unknown;
  maxQuantity: number;
  availability: "AVAILABLE" | "UNAVAILABLE";
  imageUrl?: string | null;
  createdAt: Date;
}

function serializeMenuItem(item: MenuItemRecord): MenuItemResponseDto {
  const priceMinor = Math.round(Number(item.price) * 100);
  return {
    id: item.id,
    categoryId: item.categoryId,
    name: item.name,
    description: item.description ?? null,
    priceMinor,
    priceFormatted: formatCurrency(priceMinor),
    maxQuantity: item.maxQuantity,
    availability: item.availability,
    imageUrl: item.imageUrl ?? null,
    createdAt:
      item.createdAt instanceof Date
        ? item.createdAt.toISOString()
        : new Date(item.createdAt).toISOString(),
  };
}

export class MenuService {
  async getRestaurantMenu(restaurantId: string): Promise<CategoryWithItemsResponseDto[]> {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true },
    });
    if (!restaurant) {
      throw new NotFoundError("Restaurant not found");
    }

    const categories = await prisma.menuCategory.findMany({
      where: {
        restaurantId,
        isArchived: false,
      },
      include: {
        items: {
          where: { isArchived: false },
          orderBy: { name: "asc" },
        },
      },
      orderBy: { sortOrder: "asc" },
    });

    return categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      description: cat.description ?? null,
      sortOrder: cat.sortOrder,
      items: cat.items.map(serializeMenuItem),
    }));
  }

  async createCategory(
    restaurantId: string,
    dto: CreateCategoryRequestDto
  ): Promise<CategoryResponseDto> {
    const data: Record<string, unknown> = {
      restaurantId,
      name: dto.name,
      sortOrder: dto.sortOrder,
    };
    if (dto.description !== undefined) {
      data.description = dto.description;
    }

    const category = await prisma.menuCategory.create({
      data: data as Parameters<typeof prisma.menuCategory.create>[0]["data"],
    });

    return {
      id: category.id,
      restaurantId: category.restaurantId,
      name: category.name,
      description: category.description,
      sortOrder: category.sortOrder,
      createdAt: category.createdAt.toISOString(),
    };
  }

  async updateCategory(
    restaurantId: string,
    categoryId: string,
    dto: UpdateCategoryRequestDto
  ): Promise<CategoryResponseDto> {
    const category = await prisma.menuCategory.findUnique({
      where: { id: categoryId },
    });

    if (!category || category.restaurantId !== restaurantId) {
      throw new NotFoundError("Category not found");
    }

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;

    const updated = await prisma.menuCategory.update({
      where: { id: categoryId },
      data: data as Parameters<typeof prisma.menuCategory.update>[0]["data"],
    });

    return {
      id: updated.id,
      restaurantId: updated.restaurantId,
      name: updated.name,
      description: updated.description,
      sortOrder: updated.sortOrder,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  async deleteCategory(restaurantId: string, categoryId: string): Promise<{ success: boolean }> {
    const category = await prisma.menuCategory.findUnique({
      where: { id: categoryId },
    });

    if (!category || category.restaurantId !== restaurantId) {
      throw new NotFoundError("Category not found");
    }

    await prisma.$transaction([
      prisma.menuCategory.update({
        where: { id: categoryId },
        data: { isArchived: true },
      }),
      prisma.menuItem.updateMany({
        where: { categoryId },
        data: { isArchived: true },
      }),
    ]);

    return { success: true };
  }

  async createMenuItem(
    restaurantId: string,
    dto: CreateMenuItemRequestDto
  ): Promise<MenuItemResponseDto> {
    const category = await prisma.menuCategory.findUnique({
      where: { id: dto.categoryId },
    });

    if (!category || category.restaurantId !== restaurantId) {
      throw new NotFoundError("Menu category not found for this restaurant");
    }

    const priceDecimal = dto.priceMinor / 100;
    const data: Record<string, unknown> = {
      categoryId: dto.categoryId,
      name: dto.name,
      price: priceDecimal,
      maxQuantity: dto.maxQuantity,
      availability: dto.availability,
    };
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.imageUrl !== undefined) data.imageUrl = dto.imageUrl;

    const item = await prisma.menuItem.create({
      data: data as Parameters<typeof prisma.menuItem.create>[0]["data"],
    });

    return serializeMenuItem(item);
  }

  async updateMenuItem(
    restaurantId: string,
    itemId: string,
    dto: UpdateMenuItemRequestDto
  ): Promise<MenuItemResponseDto> {
    const item = await prisma.menuItem.findUnique({
      where: { id: itemId },
      include: { category: true },
    });

    if (!item || item.category.restaurantId !== restaurantId) {
      throw new NotFoundError("Menu item not found for this restaurant");
    }

    const data: Record<string, unknown> = {};
    if (dto.categoryId !== undefined) data.categoryId = dto.categoryId;
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.priceMinor !== undefined) data.price = dto.priceMinor / 100;
    if (dto.maxQuantity !== undefined) data.maxQuantity = dto.maxQuantity;
    if (dto.availability !== undefined) data.availability = dto.availability;
    if (dto.imageUrl !== undefined) data.imageUrl = dto.imageUrl;

    const updated = await prisma.menuItem.update({
      where: { id: itemId },
      data: data as Parameters<typeof prisma.menuItem.update>[0]["data"],
    });

    return serializeMenuItem(updated);
  }

  async toggleItemAvailability(
    restaurantId: string,
    itemId: string,
    availability: "AVAILABLE" | "UNAVAILABLE"
  ): Promise<MenuItemResponseDto> {
    const item = await prisma.menuItem.findUnique({
      where: { id: itemId },
      include: { category: true },
    });

    if (!item || item.category.restaurantId !== restaurantId) {
      throw new NotFoundError("Menu item not found for this restaurant");
    }

    const updated = await prisma.menuItem.update({
      where: { id: itemId },
      data: { availability },
    });

    return serializeMenuItem(updated);
  }

  async deleteMenuItem(restaurantId: string, itemId: string): Promise<{ success: boolean }> {
    const item = await prisma.menuItem.findUnique({
      where: { id: itemId },
      include: { category: true },
    });

    if (!item || item.category.restaurantId !== restaurantId) {
      throw new NotFoundError("Menu item not found for this restaurant");
    }

    await prisma.menuItem.update({
      where: { id: itemId },
      data: { isArchived: true },
    });

    return { success: true };
  }
}

export const menuService = new MenuService();

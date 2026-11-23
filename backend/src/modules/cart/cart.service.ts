import { prisma } from "../../database/prisma.js";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "../../common/errors/api-error.js";
import {
  formatCurrency,
  CURRENCY,
  calculatePlatformFee,
  BASE_DELIVERY_FEE_MINOR,
  calculateDeliveryFee,
} from "../../utils/money.js";
import { calculateHaversineDistanceKm } from "../../utils/geo.js";
import type {
  AddCartItemRequestDto,
  UpdateCartItemRequestDto,
  CartResponseDto,
  CartItemResponseDto,
} from "./dto/cart.dto.js";

export class CartService {
  private async getOrCreateCart(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const parts = (user?.name || "Customer").split(" ");
    const firstName = parts[0] || "Customer";
    const lastName = parts.slice(1).join(" ") || "Customer";

    const profile = await prisma.customerProfile.upsert({
      where: { userId },
      create: { userId, firstName, lastName },
      update: {},
    });

    return prisma.cart.upsert({
      where: { customerId: profile.id },
      create: { customerId: profile.id },
      update: {},
      include: {
        items: {
          include: {
            menuItem: {
              include: { category: { include: { restaurant: true } } },
            },
          },
        },
      },
    });
  }

  async getCart(userId: string, addressId?: string): Promise<CartResponseDto> {
    const cart = await this.getOrCreateCart(userId);

    let restaurantName: string | null = null;
    let restaurantLocation: { lat: number; lng: number } | null = null;

    if (cart.restaurantId) {
      const rest = await prisma.restaurant.findUnique({
        where: { id: cart.restaurantId },
      });
      if (rest) {
        restaurantName = rest.name;
        restaurantLocation = {
          lat: Number(rest.latitude),
          lng: Number(rest.longitude),
        };
      }
    }

    let subtotalMinor = 0;
    const items: CartItemResponseDto[] = cart.items.map((item) => {
      const priceMinor = Math.round(Number(item.menuItem.price) * 100);
      const itemTotalMinor = priceMinor * item.quantity;
      subtotalMinor += itemTotalMinor;

      return {
        id: item.id,
        menuItemId: item.menuItemId,
        name: item.menuItem.name,
        priceMinor,
        priceFormatted: formatCurrency(priceMinor),
        quantity: item.quantity,
        itemTotalMinor,
        itemTotalFormatted: formatCurrency(itemTotalMinor),
        imageUrl: item.menuItem.imageUrl,
        availability: item.menuItem.availability,
      };
    });

    let deliveryFeeMinor = items.length > 0 ? BASE_DELIVERY_FEE_MINOR : 0;

    if (items.length > 0 && restaurantLocation) {
      // Find delivery address to estimate distance-based fee
      const profile = await prisma.customerProfile.findUnique({ where: { userId } });
      const address = addressId
        ? await prisma.address.findUnique({ where: { id: addressId } })
        : profile
        ? await prisma.address.findFirst({
            where: { customerId: profile.id, isDefault: true },
          })
        : null;

      if (address) {
        const distKm = calculateHaversineDistanceKm(
          restaurantLocation.lat,
          restaurantLocation.lng,
          Number(address.latitude),
          Number(address.longitude)
        );
        deliveryFeeMinor = calculateDeliveryFee(distKm);
      }
    }

    const platformFeeMinor = items.length > 0 ? calculatePlatformFee(subtotalMinor) : 0;
    const totalMinor = subtotalMinor + deliveryFeeMinor + platformFeeMinor;

    return {
      id: cart.id,
      restaurantId: cart.restaurantId,
      restaurantName,
      items,
      itemCount: items.reduce((acc, it) => acc + it.quantity, 0),
      pricing: {
        currency: CURRENCY,
        subtotalMinor,
        subtotalFormatted: formatCurrency(subtotalMinor),
        deliveryFeeMinor,
        deliveryFeeFormatted: formatCurrency(deliveryFeeMinor),
        platformFeeMinor,
        platformFeeFormatted: formatCurrency(platformFeeMinor),
        totalMinor,
        totalFormatted: formatCurrency(totalMinor),
      },
    };
  }

  async addItem(userId: string, dto: AddCartItemRequestDto): Promise<CartResponseDto> {
    const menuItem = await prisma.menuItem.findUnique({
      where: { id: dto.menuItemId },
      include: { category: { include: { restaurant: true } } },
    });

    if (!menuItem || menuItem.isArchived) {
      throw new NotFoundError("Menu item not found");
    }

    if (menuItem.availability !== "AVAILABLE") {
      throw new BadRequestError("This menu item is currently unavailable");
    }

    const itemRestaurantId = menuItem.category.restaurantId;
    const cart = await this.getOrCreateCart(userId);

    // Enforce One-Restaurant Rule
    if (cart.restaurantId && cart.restaurantId !== itemRestaurantId && cart.items.length > 0) {
      if (!dto.clearCartIfDifferentRestaurant) {
        throw new ConflictError(
          "Your cart already contains items from a different restaurant. Would you like to clear your cart and start a new order?",
          {
            differentRestaurant: true,
            currentRestaurantId: cart.restaurantId,
            newRestaurantId: itemRestaurantId,
          }
        );
      }

      // Clear existing items from other restaurant
      await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
      await prisma.cart.update({
        where: { id: cart.id },
        data: { restaurantId: itemRestaurantId },
      });
    } else if (!cart.restaurantId || cart.items.length === 0) {
      await prisma.cart.update({
        where: { id: cart.id },
        data: { restaurantId: itemRestaurantId },
      });
    }

    const existingCartItem = await prisma.cartItem.findUnique({
      where: {
        cartId_menuItemId: {
          cartId: cart.id,
          menuItemId: dto.menuItemId,
        },
      },
    });

    const newQuantity = (existingCartItem?.quantity ?? 0) + dto.quantity;
    if (newQuantity > menuItem.maxQuantity) {
      throw new BadRequestError(
        `Cannot add more than ${menuItem.maxQuantity} of this item to cart`
      );
    }

    if (existingCartItem) {
      await prisma.cartItem.update({
        where: { id: existingCartItem.id },
        data: { quantity: newQuantity },
      });
    } else {
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          menuItemId: dto.menuItemId,
          quantity: dto.quantity,
        },
      });
    }

    return this.getCart(userId);
  }

  async updateItemQuantity(
    userId: string,
    cartItemId: string,
    dto: UpdateCartItemRequestDto
  ): Promise<CartResponseDto> {
    const cart = await this.getOrCreateCart(userId);

    const cartItem = await prisma.cartItem.findUnique({
      where: { id: cartItemId },
      include: { menuItem: true },
    });

    if (!cartItem || cartItem.cartId !== cart.id) {
      throw new NotFoundError("Cart item not found");
    }

    if (dto.quantity > cartItem.menuItem.maxQuantity) {
      throw new BadRequestError(
        `Cannot set quantity higher than ${cartItem.menuItem.maxQuantity}`
      );
    }

    await prisma.cartItem.update({
      where: { id: cartItemId },
      data: { quantity: dto.quantity },
    });

    return this.getCart(userId);
  }

  async removeItem(userId: string, cartItemId: string): Promise<CartResponseDto> {
    const cart = await this.getOrCreateCart(userId);

    const cartItem = await prisma.cartItem.findUnique({
      where: { id: cartItemId },
    });

    if (!cartItem || cartItem.cartId !== cart.id) {
      throw new NotFoundError("Cart item not found");
    }

    await prisma.cartItem.delete({
      where: { id: cartItemId },
    });

    const remaining = await prisma.cartItem.count({ where: { cartId: cart.id } });
    if (remaining === 0) {
      await prisma.cart.update({
        where: { id: cart.id },
        data: { restaurantId: null },
      });
    }

    return this.getCart(userId);
  }

  async clearCart(userId: string): Promise<CartResponseDto> {
    const cart = await this.getOrCreateCart(userId);

    await prisma.$transaction([
      prisma.cartItem.deleteMany({ where: { cartId: cart.id } }),
      prisma.cart.update({
        where: { id: cart.id },
        data: { restaurantId: null },
      }),
    ]);

    return this.getCart(userId);
  }
}

export const cartService = new CartService();

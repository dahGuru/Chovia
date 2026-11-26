import { api } from "./api";

export interface CartItemResponseDto {
  id: string;
  menuItemId: string;
  name: string;
  priceMinor: number;
  priceFormatted: string;
  quantity: number;
  itemTotalMinor: number;
  itemTotalFormatted: string;
  imageUrl?: string | null;
  availability: "AVAILABLE" | "UNAVAILABLE";
}

export interface CartResponseDto {
  id: string;
  restaurantId?: string | null;
  restaurantName?: string | null;
  items: CartItemResponseDto[];
  itemCount: number;
  pricing: {
    currency: string;
    subtotalMinor: number;
    subtotalFormatted: string;
    deliveryFeeMinor: number;
    deliveryFeeFormatted: string;
    platformFeeMinor: number;
    platformFeeFormatted: string;
    totalMinor: number;
    totalFormatted: string;
  };
}

export interface AddCartItemRequestDto {
  menuItemId: string;
  quantity?: number;
  clearCartIfDifferentRestaurant?: boolean;
}

export const cartService = {
  async getCart(addressId?: string): Promise<CartResponseDto> {
    const { data } = await api.get<CartResponseDto>("/cart", {
      params: addressId ? { addressId } : undefined,
    });
    return data;
  },

  async addItem(payload: AddCartItemRequestDto): Promise<CartResponseDto> {
    const { data } = await api.post<CartResponseDto>("/cart/items", payload);
    return data;
  },

  async updateItemQuantity(cartItemId: string, quantity: number): Promise<CartResponseDto> {
    const { data } = await api.patch<CartResponseDto>(`/cart/items/${cartItemId}`, { quantity });
    return data;
  },

  async removeItem(cartItemId: string): Promise<CartResponseDto> {
    const { data } = await api.delete<CartResponseDto>(`/cart/items/${cartItemId}`);
    return data;
  },

  async clearCart(): Promise<CartResponseDto> {
    const { data } = await api.delete<CartResponseDto>("/cart");
    return data;
  },
};

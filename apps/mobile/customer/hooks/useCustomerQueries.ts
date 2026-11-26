import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { accountService, type UpdateUserRequestDto } from "../services/accountService";
import {
  addressService,
  type CreateAddressRequestDto,
  type UpdateAddressRequestDto,
} from "../services/addressService";
import { cartService, type AddCartItemRequestDto } from "../services/cartService";
import { orderService, type CheckoutRequestDto } from "../services/orderService";
import { paymentService, type InitializePaymentRequestDto } from "../services/paymentService";
import { restaurantService, type ListRestaurantsQuery } from "../services/restaurantService";
import { useAuthStore } from "../store/useAuthStore";

export const queryKeys = {
  restaurants: (q?: ListRestaurantsQuery) => ["restaurants", q] as const,
  restaurant: (id: string) => ["restaurant", id] as const,
  menu: (restaurantId: string) => ["menu", restaurantId] as const,
  cart: (addressId?: string | null) => ["cart", addressId ?? "default"] as const,
  addresses: ["addresses"] as const,
  orders: (status?: string) => ["orders", status ?? "all"] as const,
  order: (id: string) => ["order", id] as const,
  tracking: (orderId: string) => ["tracking", orderId] as const,
  favorites: ["favorites"] as const,
  notifications: ["notifications"] as const,
  profile: ["profile"] as const,
};

export function useRestaurants(query?: ListRestaurantsQuery) {
  return useQuery({
    queryKey: queryKeys.restaurants(query),
    queryFn: () => restaurantService.list(query),
  });
}

export function useRestaurant(id: string) {
  return useQuery({
    queryKey: queryKeys.restaurant(id),
    queryFn: () => restaurantService.getById(id),
    enabled: Boolean(id),
  });
}

export function useRestaurantMenu(restaurantId: string) {
  return useQuery({
    queryKey: queryKeys.menu(restaurantId),
    queryFn: () => restaurantService.getMenu(restaurantId),
    enabled: Boolean(restaurantId),
  });
}

export function useCart(addressId?: string | null) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: queryKeys.cart(addressId),
    queryFn: () => cartService.getCart(addressId ?? undefined),
    enabled: isAuthenticated,
  });
}

export function useAddToCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: AddCartItemRequestDto) => cartService.addItem(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cart"] });
    },
  });
}

export function useUpdateCartItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) =>
      cartService.updateItemQuantity(itemId, quantity),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cart"] });
    },
  });
}

export function useRemoveCartItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => cartService.removeItem(itemId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cart"] });
    },
  });
}

export function useClearCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => cartService.clearCart(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cart"] });
    },
  });
}

export function useAddresses() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: queryKeys.addresses,
    queryFn: () => addressService.list(),
    enabled: isAuthenticated,
  });
}

export function useCreateAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateAddressRequestDto) => addressService.create(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.addresses });
      void qc.invalidateQueries({ queryKey: ["cart"] });
    },
  });
}

export function useUpdateAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateAddressRequestDto }) =>
      addressService.update(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.addresses });
    },
  });
}

export function useSetDefaultAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => addressService.setDefault(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.addresses });
      void qc.invalidateQueries({ queryKey: ["cart"] });
    },
  });
}

export function useDeleteAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => addressService.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.addresses });
    },
  });
}

export function useOrders(status?: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: queryKeys.orders(status),
    queryFn: () => orderService.list(status ? { status } : undefined),
    enabled: isAuthenticated,
  });
}

export function useOrder(id: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: queryKeys.order(id),
    queryFn: () => orderService.getById(id),
    enabled: isAuthenticated && Boolean(id),
    refetchInterval: 15_000,
  });
}

export function useDeliveryTracking(orderId: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: queryKeys.tracking(orderId),
    queryFn: () => orderService.trackDelivery(orderId),
    enabled: isAuthenticated && Boolean(orderId),
    refetchInterval: 10_000,
  });
}

export function useCheckout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CheckoutRequestDto) => orderService.checkout(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cart"] });
      void qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => orderService.cancel(id, reason),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["orders"] });
      void qc.invalidateQueries({ queryKey: queryKeys.order(vars.id) });
    },
  });
}

export function useInitializePayment() {
  return useMutation({
    mutationFn: (payload: InitializePaymentRequestDto) => paymentService.initialize(payload),
  });
}

export function useVerifyPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reference: string) => paymentService.verify(reference),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ["orders"] });
      void qc.invalidateQueries({ queryKey: queryKeys.order(data.orderId) });
    },
  });
}

export function useFavorites() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: queryKeys.favorites,
    queryFn: () => accountService.listFavorites(),
    enabled: isAuthenticated,
  });
}

export function useToggleFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (menuItemId: string) => accountService.toggleFavorite(menuItemId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.favorites });
    },
  });
}

export function useNotifications() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: queryKeys.notifications,
    queryFn: () => accountService.listNotifications(),
    enabled: isAuthenticated,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => accountService.markNotificationRead(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.notifications });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => accountService.markAllNotificationsRead(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.notifications });
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  const hydrate = useAuthStore((s) => s.hydrate);
  return useMutation({
    mutationFn: (payload: UpdateUserRequestDto) => accountService.updateProfile(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.profile });
      void hydrate();
    },
  });
}

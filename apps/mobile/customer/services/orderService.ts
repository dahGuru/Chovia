import { api } from "./api";

export interface CheckoutRequestDto {
  addressId: string;
  idempotencyKey?: string | undefined;
  notes?: string | undefined;
}

export interface OrderItemResponseDto {
  id: string;
  itemName: string;
  unitPriceMinor: number;
  unitPriceFormatted: string;
  quantity: number;
  lineTotalMinor: number;
  lineTotalFormatted: string;
}

export interface OrderStatusHistoryResponseDto {
  id: string;
  fromStatus?: string | null;
  toStatus: string;
  reason?: string | null;
  createdAt: string;
}

export interface OrderResponseDto {
  id: string;
  orderNumber: string;
  restaurantId: string;
  restaurantName: string;
  customerId: string;
  status: string;
  subtotalMinor: number;
  subtotalFormatted: string;
  deliveryFeeMinor: number;
  deliveryFeeFormatted: string;
  totalAmountMinor: number;
  totalAmountFormatted: string;
  deliveryAddressText: string;
  deliveryDistanceKm?: number | null;
  items: OrderItemResponseDto[];
  statusHistory?: OrderStatusHistoryResponseDto[];
  paymentStatus?: string;
  rejectionReason?: string | null;
  cancelledReason?: string | null;
  createdAt: string;
}

export interface DeliveryTrackingResponseDto {
  orderId: string;
  orderNumber: string;
  deliveryStatus: string;
  restaurant: {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
  };
  destination: {
    addressText: string;
    latitude: number;
    longitude: number;
  };
  rider?: {
    name: string;
    phone: string;
    vehicleType?: string | null;
    vehiclePlateNumber?: string | null;
  } | null;
  assignedAt?: string | null;
  pickedUpAt?: string | null;
  deliveredAt?: string | null;
}

export interface ListOrdersQuery {
  status?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedOrdersResponseDto {
  items: OrderResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const orderService = {
  async checkout(payload: CheckoutRequestDto): Promise<OrderResponseDto> {
    const { data } = await api.post<OrderResponseDto>("/orders/checkout", payload);
    return data;
  },

  async listPaginated(query?: ListOrdersQuery): Promise<PaginatedOrdersResponseDto> {
    const { data } = await api.get<PaginatedOrdersResponseDto>("/orders", {
      params: query,
    });
    return data;
  },

  async list(query?: ListOrdersQuery): Promise<OrderResponseDto[]> {
    const data = await orderService.listPaginated(query);
    return data.items;
  },

  async getById(id: string): Promise<OrderResponseDto> {
    const { data } = await api.get<OrderResponseDto>(`/orders/${id}`);
    return data;
  },

  async cancel(id: string, reason: string): Promise<OrderResponseDto> {
    const { data } = await api.post<OrderResponseDto>(`/orders/${id}/cancel`, { reason });
    return data;
  },

  async trackDelivery(orderId: string): Promise<DeliveryTrackingResponseDto> {
    const { data } = await api.get<DeliveryTrackingResponseDto>(`/deliveries/${orderId}/track`);
    return data;
  },
};

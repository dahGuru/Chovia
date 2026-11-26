import { z } from "zod";

export const checkoutRequestSchema = z
  .object({
    addressId: z.string().uuid("Invalid address ID"),
    idempotencyKey: z.string().optional(),
    notes: z.string().max(255).optional(),
  })
  .strict();

export type CheckoutRequestDto = z.infer<typeof checkoutRequestSchema>;

export const cancelOrderRequestSchema = z
  .object({
    reason: z.string().min(1, "Cancellation reason is required").max(255).trim(),
  })
  .strict();

export type CancelOrderRequestDto = z.infer<typeof cancelOrderRequestSchema>;

export const rejectOrderRequestSchema = z
  .object({
    reason: z.string().min(1, "Rejection reason is required").max(255).trim(),
    note: z.string().max(255).optional(),
  })
  .strict();

export type RejectOrderRequestDto = z.infer<typeof rejectOrderRequestSchema>;

export const listOrdersQuerySchema = z.object({
  status: z
    .enum([
      "PENDING_PAYMENT",
      "PENDING",
      "CONFIRMED",
      "PREPARING",
      "READY",
      "ASSIGNED",
      "OUT_FOR_DELIVERY",
      "DELIVERED",
      "REJECTED",
      "CANCELLED",
    ])
    .optional(),
  restaurantId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
});

export type ListOrdersQueryDto = z.infer<typeof listOrdersQuerySchema>;

export const orderItemResponseSchema = z
  .object({
    id: z.string().uuid(),
    itemName: z.string(),
    unitPriceMinor: z.number().int(),
    unitPriceFormatted: z.string(),
    quantity: z.number().int(),
    lineTotalMinor: z.number().int(),
    lineTotalFormatted: z.string(),
  })
  .strict();

export type OrderItemResponseDto = z.infer<typeof orderItemResponseSchema>;

export const orderStatusHistoryResponseSchema = z
  .object({
    id: z.string().uuid(),
    fromStatus: z.string().nullable().optional(),
    toStatus: z.string(),
    reason: z.string().nullable().optional(),
    createdAt: z.string(),
  })
  .strict();

export type OrderStatusHistoryResponseDto = z.infer<typeof orderStatusHistoryResponseSchema>;

export const orderResponseSchema = z
  .object({
    id: z.string().uuid(),
    orderNumber: z.string(),
    restaurantId: z.string().uuid(),
    restaurantName: z.string(),
    customerId: z.string().uuid(),
    status: z.string(),
    subtotalMinor: z.number().int(),
    subtotalFormatted: z.string(),
    deliveryFeeMinor: z.number().int(),
    deliveryFeeFormatted: z.string(),
    totalAmountMinor: z.number().int(),
    totalAmountFormatted: z.string(),
    deliveryAddressText: z.string(),
    deliveryDistanceKm: z.number().nullable().optional(),
    items: z.array(orderItemResponseSchema),
    statusHistory: z.array(orderStatusHistoryResponseSchema).optional(),
    paymentStatus: z.string().optional(),
    rejectionReason: z.string().nullable().optional(),
    cancelledReason: z.string().nullable().optional(),
    createdAt: z.string(),
  })
  .strict();

export type OrderResponseDto = z.infer<typeof orderResponseSchema>;

export const paginatedOrdersResponseSchema = z
  .object({
    items: z.array(orderResponseSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    totalPages: z.number().int().nonnegative(),
  })
  .strict();

export type PaginatedOrdersResponseDto = z.infer<typeof paginatedOrdersResponseSchema>;

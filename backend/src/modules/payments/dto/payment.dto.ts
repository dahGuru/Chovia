import { z } from "zod";

export const initializePaymentRequestSchema = z
  .object({
    orderId: z.string().uuid("Invalid orderId"),
    callbackUrl: z.string().url().optional(),
  })
  .strict();

export type InitializePaymentRequestDto = z.infer<typeof initializePaymentRequestSchema>;

export const initializePaymentResponseSchema = z
  .object({
    authorizationUrl: z.string(),
    accessCode: z.string(),
    reference: z.string(),
    orderId: z.string().uuid(),
    amountMinor: z.number().int(),
    amountFormatted: z.string(),
  })
  .strict();

export type InitializePaymentResponseDto = z.infer<typeof initializePaymentResponseSchema>;

export const verifyPaymentResponseSchema = z
  .object({
    orderId: z.string().uuid(),
    reference: z.string(),
    status: z.enum(["PENDING", "SUCCESS", "FAILED", "ABANDONED"]),
    paidAt: z.string().nullable().optional(),
    amountMinor: z.number().int(),
  })
  .strict();

export type VerifyPaymentResponseDto = z.infer<typeof verifyPaymentResponseSchema>;

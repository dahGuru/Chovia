import { z } from "zod";
import { AUTH_CONSTRAINTS } from "@chovia/validation";
export { userResponseSchema, type UserResponseDto } from "../../auth/dto/auth.dto.js";

export const updateUserRequestSchema = z
  .object({
    firstName: z.string().min(1).max(100).optional(),
    lastName: z.string().min(1).max(100).optional(),
    phone: z
      .string()
      .regex(AUTH_CONSTRAINTS.phone.pattern, AUTH_CONSTRAINTS.phone.message)
      .optional(),
    image: z.string().url().optional(),
  })
  .strict();

export type UpdateUserRequestDto = z.infer<typeof updateUserRequestSchema>;

export const registerDeviceRequestSchema = z
  .object({
    expoPushToken: z.string().min(1, "expoPushToken is required"),
    deviceName: z.string().max(100).optional(),
    platform: z.enum(["ios", "android", "web"]).default("web"),
  })
  .strict();

export type RegisterDeviceRequestDto = z.infer<typeof registerDeviceRequestSchema>;

export const deviceResponseSchema = z
  .object({
    id: z.string().uuid(),
    expoPushToken: z.string(),
    deviceName: z.string().nullable().optional(),
    platform: z.string().nullable().optional(),
    isActive: z.boolean(),
    lastSeenAt: z.string().nullable().optional(),
    createdAt: z.string(),
  })
  .strict();

export type DeviceResponseDto = z.infer<typeof deviceResponseSchema>;

export const uploadSignatureRequestSchema = z
  .object({
    folder: z.enum(["avatars", "restaurants", "menu", "documents", "categories", "cuisines"]),
    restaurantId: z.string().uuid().optional(),
    mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf"]).optional(),
    fileSizeBytes: z.number().int().positive().max(10 * 1024 * 1024).optional(),
    customPublicId: z.string().max(200).optional(),
  })
  .strict();

export type UploadSignatureRequestDto = z.infer<typeof uploadSignatureRequestSchema>;

export const uploadSignatureResponseSchema = z
  .object({
    signature: z.string(),
    timestamp: z.number(),
    cloudName: z.string(),
    apiKey: z.string(),
    folder: z.string(),
    allowedFormats: z.array(z.string()),
    maxFileSize: z.number(),
    resourceType: z.string(),
    deliveryType: z.enum(["upload", "authenticated"]).optional(),
    publicId: z.string().optional(),
  })
  .strict();

export type UploadSignatureResponseDto = z.infer<typeof uploadSignatureResponseSchema>;

export const uploadImageRequestSchema = z
  .object({
    file: z.string().min(1, "File payload (base64, data URI, or URL) is required"),
    folder: z.enum(["avatars", "restaurants", "menu", "documents", "categories", "cuisines"]),
    restaurantId: z.string().uuid().optional(),
    mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf"]).optional(),
    fileSizeBytes: z.number().int().positive().max(10 * 1024 * 1024).optional(),
    customPublicId: z.string().max(200).optional(),
  })
  .strict();

export type UploadImageRequestDto = z.infer<typeof uploadImageRequestSchema>;

export const verifyUploadRequestSchema = z
  .object({
    folder: z.enum(["avatars", "restaurants", "menu", "documents", "categories", "cuisines"]),
    publicId: z.string().min(1, "publicId is required"),
    format: z.string().optional(),
    bytes: z.number().int().positive().optional(),
    resourceType: z.string().optional(),
    restaurantId: z.string().uuid().optional(),
  })
  .strict();

export type VerifyUploadRequestDto = z.infer<typeof verifyUploadRequestSchema>;

export const verifyUploadResponseSchema = z
  .object({
    verified: z.boolean(),
    folder: z.string(),
    publicId: z.string(),
  })
  .strict();

export type VerifyUploadResponseDto = z.infer<typeof verifyUploadResponseSchema>;


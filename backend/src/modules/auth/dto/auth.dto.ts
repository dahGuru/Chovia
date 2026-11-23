import { z } from "zod";
import { AUTH_CONSTRAINTS } from "@chovia/validation";

export const registerRequestSchema = z
  .object({
    email: z
      .string()
      .email("Invalid email format")
      .max(AUTH_CONSTRAINTS.email.maxLength)
      .toLowerCase()
      .trim(),
    password: z
      .string()
      .min(
        AUTH_CONSTRAINTS.password.minLength,
        `Password must be at least ${AUTH_CONSTRAINTS.password.minLength} characters`
      )
      .max(AUTH_CONSTRAINTS.password.maxLength)
      .regex(AUTH_CONSTRAINTS.password.pattern, AUTH_CONSTRAINTS.password.message),
    firstName: z.string().min(1, "First name is required").max(100).trim(),
    lastName: z.string().min(1, "Last name is required").max(100).trim(),
    phone: z
      .string()
      .regex(AUTH_CONSTRAINTS.phone.pattern, AUTH_CONSTRAINTS.phone.message)
      .trim(),
  })
  .strict();

export type RegisterRequestDto = z.infer<typeof registerRequestSchema>;

export const loginRequestSchema = z
  .object({
    email: z.string().email("Invalid email format").toLowerCase().trim(),
    password: z.string().min(1, "Password is required"),
    deviceInfo: z
      .object({
        deviceId: z.string().optional(),
        deviceName: z.string().optional(),
        deviceType: z.enum(["IOS", "ANDROID", "WEB"]).default("WEB"),
        pushToken: z.string().optional(),
      })
      .optional(),
  })
  .strict();

export type LoginRequestDto = z.infer<typeof loginRequestSchema>;

export const refreshTokenRequestSchema = z
  .object({
    refreshToken: z.string().min(1, "Refresh token is required"),
  })
  .strict();

export type RefreshTokenRequestDto = z.infer<typeof refreshTokenRequestSchema>;

export const logoutRequestSchema = z
  .object({
    refreshToken: z.string().min(1, "Refresh token is required"),
  })
  .strict();

export type LogoutRequestDto = z.infer<typeof logoutRequestSchema>;

export const verifyEmailRequestSchema = z
  .object({
    email: z.string().email().toLowerCase().trim(),
  })
  .strict();

export type VerifyEmailRequestDto = z.infer<typeof verifyEmailRequestSchema>;

export const verifyEmailOtpSchema = z
  .object({
    email: z.string().email().toLowerCase().trim(),
    otp: z.string().regex(/^\d{6}$/, "OTP must be exactly 6 digits"),
    signedToken: z.string().min(1, "Signed token is required"),
  })
  .strict();

export type VerifyEmailOtpDto = z.infer<typeof verifyEmailOtpSchema>;

export const passwordResetRequestSchema = z
  .object({
    email: z.string().email().toLowerCase().trim(),
  })
  .strict();

export type PasswordResetRequestDto = z.infer<typeof passwordResetRequestSchema>;

export const passwordResetVerifySchema = z
  .object({
    email: z.string().email().toLowerCase().trim(),
    otp: z.string().regex(/^\d{6}$/, "OTP must be exactly 6 digits"),
    signedToken: z.string().min(1, "Signed token is required"),
  })
  .strict();

export type PasswordResetVerifyDto = z.infer<typeof passwordResetVerifySchema>;

export const passwordResetCompleteSchema = z
  .object({
    email: z.string().email().toLowerCase().trim(),
    resetToken: z.string().min(1, "Reset token is required"),
    newPassword: z
      .string()
      .min(
        AUTH_CONSTRAINTS.password.minLength,
        `Password must be at least ${AUTH_CONSTRAINTS.password.minLength} characters`
      )
      .max(AUTH_CONSTRAINTS.password.maxLength)
      .regex(AUTH_CONSTRAINTS.password.pattern, AUTH_CONSTRAINTS.password.message),
  })
  .strict();

export type PasswordResetCompleteDto = z.infer<typeof passwordResetCompleteSchema>;

// Response DTOs
export const userResponseSchema = z
  .object({
    id: z.string().uuid(),
    email: z.string().email(),
    role: z.enum(["CUSTOMER", "RESTAURANT_STAFF", "RIDER", "ADMIN"]),
    status: z.enum(["ACTIVE", "SUSPENDED", "DEACTIVATED"]),
    emailVerified: z.boolean(),
    phoneVerified: z.boolean(),
    firstName: z.string().nullable().optional(),
    lastName: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    createdAt: z.string(),
  })
  .strict();

export type UserResponseDto = z.infer<typeof userResponseSchema>;

export const authResponseSchema = z
  .object({
    accessToken: z.string(),
    refreshToken: z.string(),
    user: userResponseSchema,
  })
  .strict();

export type AuthResponseDto = z.infer<typeof authResponseSchema>;

export const otpSentResponseSchema = z
  .object({
    message: z.string(),
    signedToken: z.string(),
    expiresInMinutes: z.number(),
  })
  .strict();

export type OtpSentResponseDto = z.infer<typeof otpSentResponseSchema>;

export const messageResponseSchema = z
  .object({
    message: z.string(),
    success: z.boolean().default(true),
  })
  .strict();

export type MessageResponseDto = z.infer<typeof messageResponseSchema>;

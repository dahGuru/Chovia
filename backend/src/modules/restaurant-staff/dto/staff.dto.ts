import { z } from "zod";
import { AUTH_CONSTRAINTS } from "@chovia/validation";

export const inviteStaffRequestSchema = z
  .object({
    email: z.string().email().toLowerCase().trim(),
    role: z.enum(["RESTAURANT_STAFF"]).default("RESTAURANT_STAFF"),
  })
  .strict();

export type InviteStaffRequestDto = z.infer<typeof inviteStaffRequestSchema>;

export const acceptStaffInvitationRequestSchema = z
  .object({
    token: z.string().min(1, "Invite token is required"),
    email: z.string().email().toLowerCase().trim(),
    password: z
      .string()
      .min(
        AUTH_CONSTRAINTS.password.minLength,
        `Password must be at least ${AUTH_CONSTRAINTS.password.minLength} characters`
      )
      .max(AUTH_CONSTRAINTS.password.maxLength)
      .regex(AUTH_CONSTRAINTS.password.pattern, AUTH_CONSTRAINTS.password.message),
    firstName: z.string().min(1).max(100).trim(),
    lastName: z.string().min(1).max(100).trim(),
    phone: z
      .string()
      .regex(AUTH_CONSTRAINTS.phone.pattern, AUTH_CONSTRAINTS.phone.message)
      .trim(),
  })
  .strict();

export type AcceptStaffInvitationRequestDto = z.infer<typeof acceptStaffInvitationRequestSchema>;

export const staffMemberResponseSchema = z
  .object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    name: z.string(),
    email: z.string().email(),
    phone: z.string(),
    status: z.enum(["ACTIVE", "INACTIVE"]),
    createdAt: z.string(),
  })
  .strict();

export type StaffMemberResponseDto = z.infer<typeof staffMemberResponseSchema>;

export const staffInvitationResponseSchema = z
  .object({
    id: z.string().uuid(),
    email: z.string().email(),
    restaurantId: z.string().uuid(),
    role: z.string(),
    expiresAt: z.string(),
    createdAt: z.string(),
  })
  .strict();

export type StaffInvitationResponseDto = z.infer<typeof staffInvitationResponseSchema>;

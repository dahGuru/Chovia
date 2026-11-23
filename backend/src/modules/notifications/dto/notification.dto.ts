import { z } from "zod";

export const notificationResponseSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string(),
    message: z.string(),
    type: z.string(),
    isRead: z.boolean(),
    readAt: z.string().nullable().optional(),
    createdAt: z.string(),
  })
  .strict();

export type NotificationResponseDto = z.infer<typeof notificationResponseSchema>;

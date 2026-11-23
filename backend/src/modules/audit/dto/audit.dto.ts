import { z } from "zod";

export const createAuditLogSchema = z.object({
  actorUserId: z.string().uuid().optional(),
  action: z.enum([
    "CREATE",
    "UPDATE",
    "DELETE",
    "APPROVE",
    "REJECT",
    "SUSPEND",
    "UNSUSPEND",
    "CANCEL",
    "REFUND",
    "ASSIGN",
    "RELEASE",
    "PICKUP",
    "DELIVER",
    "LOGIN",
    "LOGOUT",
    "OTHER",
  ]),
  entityType: z.string().min(1),
  entityId: z.string().optional(),
  before: z.any().optional(),
  after: z.any().optional(),
  metadata: z.any().optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
});

export type CreateAuditLogDto = z.infer<typeof createAuditLogSchema>;

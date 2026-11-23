import { prisma } from "../../database/prisma.js";
import type { CreateAuditLogDto } from "./dto/audit.dto.js";

export class AuditService {
  async log(dto: CreateAuditLogDto): Promise<void> {
    try {
      const data: Record<string, unknown> = {
        action: dto.action,
        entityType: dto.entityType,
      };

      if (dto.actorUserId) data.actorUserId = dto.actorUserId;
      if (dto.entityId) data.entityId = dto.entityId;
      if (dto.before !== undefined) data.before = dto.before;
      if (dto.after !== undefined) data.after = dto.after;
      if (dto.metadata !== undefined) data.metadata = dto.metadata;
      if (dto.ipAddress) data.ipAddress = dto.ipAddress;
      if (dto.userAgent) data.userAgent = dto.userAgent;

      await prisma.auditLog.create({
        data: data as Parameters<typeof prisma.auditLog.create>[0]["data"],
      });
    } catch {
      // Never let audit logging failure crash primary transaction
    }
  }
}

export const auditService = new AuditService();

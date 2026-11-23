import type { FastifyPluginAsync } from "fastify";
import "../../types/auth.js";
import { adminService } from "./admin.service.js";
import {
  updateRestaurantStatusSchema,
  updateRiderStatusByAdminSchema,
  listAuditLogsQuerySchema,
} from "./dto/admin.dto.js";
import { authorize } from "../../plugins/auth-guard.js";

export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", authorize(["ADMIN"]));

  fastify.get(
    "/metrics",
    {
      schema: {
        description: "Get high-level platform health and business metrics (Admin only)",
        tags: ["Admin"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const metrics = await adminService.getMetrics();
      return reply.status(200).send(metrics);
    }
  );

  fastify.patch(
    "/restaurants/:id/status",
    {
      schema: {
        description: "Approve, suspend, or reject a restaurant (Admin only)",
        tags: ["Admin"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = updateRestaurantStatusSchema.parse(request.body);
      const result = await adminService.updateRestaurantStatus(request.user.id, id, body);
      return reply.status(200).send(result);
    }
  );

  fastify.patch(
    "/riders/:id/status",
    {
      schema: {
        description: "Approve or suspend a rider profile (Admin only)",
        tags: ["Admin"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = updateRiderStatusByAdminSchema.parse(request.body);
      const result = await adminService.updateRiderStatus(request.user.id, id, body);
      return reply.status(200).send(result);
    }
  );

  fastify.get(
    "/audit-logs",
    {
      schema: {
        description: "Query system audit logs with filters and pagination (Admin only)",
        tags: ["Admin"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const query = listAuditLogsQuerySchema.parse(request.query);
      const logs = await adminService.listAuditLogs(query);
      return reply.status(200).send(logs);
    }
  );
};

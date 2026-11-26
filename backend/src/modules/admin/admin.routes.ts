import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import "../../types/auth.js";
import { adminService } from "./admin.service.js";
import { riderKycService } from "../delivery/rider-kyc.service.js";
import {
  adminApproveKycSchema,
  adminRejectKycSchema,
  listRiderKycApplicationsQuerySchema,
  paginatedRiderKycApplicationsSchema,
  riderKycApplicationResponseSchema,
} from "../delivery/dto/kyc.dto.js";
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
    "/riders/applications",
    {
      schema: {
        description: "List rider KYC applications for admin review",
        tags: ["Admin", "Riders"],
        security: [{ bearerAuth: [] }],
        querystring: listRiderKycApplicationsQuerySchema,
        response: {
          200: paginatedRiderKycApplicationsSchema,
        },
      },
    },
    async (request, reply) => {
      const query = listRiderKycApplicationsQuerySchema.parse(request.query);
      const result = await riderKycService.listApplications(query);
      return reply.status(200).send(result);
    }
  );

  fastify.get(
    "/riders/applications/:id",
    {
      schema: {
        description: "Get detailed rider KYC application with short-lived signed document URLs",
        tags: ["Admin", "Riders"],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: z.string().uuid() }),
        response: {
          200: riderKycApplicationResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = await riderKycService.getApplicationById(id);
      return reply.status(200).send(result);
    }
  );

  fastify.post(
    "/riders/applications/:id/approve",
    {
      schema: {
        description: "Approve rider KYC application and activate rider profile",
        tags: ["Admin", "Riders"],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: z.string().uuid() }),
        body: adminApproveKycSchema.optional(),
        response: {
          200: riderKycApplicationResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body ? adminApproveKycSchema.parse(request.body) : {};
      const result = await riderKycService.approveApplication(request.user.id, id, body.notes);
      return reply.status(200).send(result);
    }
  );

  fastify.post(
    "/riders/applications/:id/reject",
    {
      schema: {
        description: "Reject rider KYC application with review reason",
        tags: ["Admin", "Riders"],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: z.string().uuid() }),
        body: adminRejectKycSchema,
        response: {
          200: riderKycApplicationResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = adminRejectKycSchema.parse(request.body);
      const result = await riderKycService.rejectApplication(
        request.user.id,
        id,
        body.reason,
        body.notes
      );
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

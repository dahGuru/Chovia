import type { FastifyPluginAsync } from "fastify";
import "../../types/auth.js";
import { restaurantStaffService } from "./restaurant-staff.service.js";
import {
  inviteStaffRequestSchema,
  acceptStaffInvitationRequestSchema,
} from "./dto/staff.dto.js";
import { requireRestaurantStaff } from "../../plugins/auth-guard.js";

export const restaurantStaffRoutes: FastifyPluginAsync = async (fastify) => {
  // Public endpoint: accept invitation
  fastify.post(
    "/invitations/accept",
    {
      schema: {
        description: "Accept a staff invitation and establish account password",
        tags: ["Staff"],
      },
    },
    async (request, reply) => {
      const body = acceptStaffInvitationRequestSchema.parse(request.body);
      const result = await restaurantStaffService.acceptInvitation(body);
      return reply.status(200).send(result);
    }
  );

  // Authenticated endpoints for restaurant staff management
  fastify.post(
    "/restaurants/:restaurantId/staff/invite",
    {
      preHandler: [fastify.authenticate, requireRestaurantStaff],
      schema: {
        description: "Invite a new staff member to restaurant",
        tags: ["Staff"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { restaurantId } = request.params as { restaurantId: string };
      const body = inviteStaffRequestSchema.parse(request.body);
      const result = await restaurantStaffService.inviteStaff(
        restaurantId,
        request.user.id,
        body
      );
      return reply.status(201).send(result);
    }
  );

  fastify.get(
    "/restaurants/:restaurantId/staff",
    {
      preHandler: [fastify.authenticate, requireRestaurantStaff],
      schema: {
        description: "List staff members for a restaurant",
        tags: ["Staff"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { restaurantId } = request.params as { restaurantId: string };
      const result = await restaurantStaffService.listStaff(restaurantId);
      return reply.status(200).send(result);
    }
  );

  fastify.delete(
    "/restaurants/:restaurantId/staff/:staffId",
    {
      preHandler: [fastify.authenticate, requireRestaurantStaff],
      schema: {
        description: "Revoke staff membership from a restaurant",
        tags: ["Staff"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { restaurantId, staffId } = request.params as {
        restaurantId: string;
        staffId: string;
      };
      const result = await restaurantStaffService.revokeMembership(restaurantId, staffId);
      return reply.status(200).send(result);
    }
  );
};

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import "../../types/auth.js";
import { deliveryService } from "./delivery.service.js";
import { riderKycService } from "./rider-kyc.service.js";
import {
  updateRiderStatusSchema,
  updateRiderLocationSchema,
  riderStatusResponseSchema,
  riderSessionProfileResponseSchema,
  deliveryResponseSchema,
  listRiderDeliveryHistoryQuerySchema,
  paginatedRiderDeliveryHistorySchema,
  deliveryTrackingResponseSchema,
  submitRiderKycRequestSchema,
  riderKycApplicationResponseSchema,
} from "./dto/index.js";
import { authorize } from "../../plugins/auth-guard.js";

export const deliveryRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", fastify.authenticate);

  // Rider Session & KYC endpoints
  fastify.get(
    "/riders/me",
    {
      preHandler: [authorize(["RIDER", "ADMIN"])],
      schema: {
        description: "Get authenticated rider profile, availability, location, and KYC status",
        tags: ["Delivery", "Riders"],
        security: [{ bearerAuth: [] }],
        response: {
          200: riderSessionProfileResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const profile = await deliveryService.getRiderSessionProfile(request.user.id);
      return reply.status(200).send(profile);
    }
  );

  fastify.get(
    "/riders/kyc",
    {
      preHandler: [authorize(["RIDER", "ADMIN"])],
      schema: {
        description: "Get authenticated rider KYC application and verification status",
        tags: ["Delivery", "Riders"],
        security: [{ bearerAuth: [] }],
        response: {
          200: riderKycApplicationResponseSchema.nullable(),
        },
      },
    },
    async (request, reply) => {
      const application = await riderKycService.getMyApplication(request.user.id);
      return reply.status(200).send(application);
    }
  );

  fastify.post(
    "/riders/kyc",
    {
      preHandler: [authorize(["RIDER", "ADMIN"])],
      schema: {
        description: "Submit or resubmit rider KYC verification application",
        tags: ["Delivery", "Riders"],
        security: [{ bearerAuth: [] }],
        body: submitRiderKycRequestSchema,
        response: {
          200: riderKycApplicationResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const body = submitRiderKycRequestSchema.parse(request.body);
      const application = await riderKycService.submitApplication(request.user.id, body);
      return reply.status(200).send(application);
    }
  );

  // Rider availability & location endpoints
  fastify.patch(
    "/riders/status",
    {
      preHandler: [authorize(["RIDER", "ADMIN"])],
      schema: {
        description: "Toggle rider online/offline availability status with GPS coordinates when going online",
        tags: ["Delivery", "Riders"],
        security: [{ bearerAuth: [] }],
        body: updateRiderStatusSchema,
        response: {
          200: riderStatusResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const body = updateRiderStatusSchema.parse(request.body);
      const result = await deliveryService.updateRiderStatus(request.user.id, body);
      return reply.status(200).send(result);
    }
  );

  fastify.patch(
    "/riders/location",
    {
      preHandler: [authorize(["RIDER", "ADMIN"])],
      schema: {
        description: "Update authenticated rider live GPS coordinates",
        tags: ["Delivery", "Riders"],
        security: [{ bearerAuth: [] }],
        body: updateRiderLocationSchema,
        response: {
          200: riderStatusResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const body = updateRiderLocationSchema.parse(request.body);
      const result = await deliveryService.updateRiderLocation(request.user.id, body);
      return reply.status(200).send(result);
    }
  );

  fastify.get(
    "/riders/deliveries/available",
    {
      preHandler: [authorize(["RIDER", "ADMIN"])],
      schema: {
        description: "List available delivery assignments for active approved riders",
        tags: ["Delivery"],
        security: [{ bearerAuth: [] }],
        response: {
          200: z.array(deliveryResponseSchema),
        },
      },
    },
    async (request, reply) => {
      const result = await deliveryService.getAvailableDeliveries(request.user.id);
      return reply.status(200).send(result);
    }
  );

  fastify.get(
    "/riders/deliveries/active",
    {
      preHandler: [authorize(["RIDER", "ADMIN"])],
      schema: {
        description: "Get currently active delivery assignment for authenticated rider",
        tags: ["Delivery", "Riders"],
        security: [{ bearerAuth: [] }],
        response: {
          200: deliveryResponseSchema.nullable(),
        },
      },
    },
    async (request, reply) => {
      const result = await deliveryService.getActiveDelivery(request.user.id);
      return reply.status(200).send(result);
    }
  );

  fastify.get(
    "/riders/deliveries/history",
    {
      preHandler: [authorize(["RIDER", "ADMIN"])],
      schema: {
        description: "Get paginated delivery history and cumulative earnings for authenticated rider",
        tags: ["Delivery", "Riders"],
        security: [{ bearerAuth: [] }],
        querystring: listRiderDeliveryHistoryQuerySchema,
        response: {
          200: paginatedRiderDeliveryHistorySchema,
        },
      },
    },
    async (request, reply) => {
      const query = listRiderDeliveryHistoryQuerySchema.parse(request.query);
      const result = await deliveryService.getDeliveryHistory(request.user.id, query);
      return reply.status(200).send(result);
    }
  );

  fastify.post(
    "/riders/deliveries/:deliveryId/accept",
    {
      preHandler: [authorize(["RIDER", "ADMIN"])],
      schema: {
        description: "Rider accepts a delivery assignment",
        tags: ["Delivery"],
        security: [{ bearerAuth: [] }],
        params: z.object({ deliveryId: z.string().uuid() }),
        response: {
          200: deliveryResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { deliveryId } = request.params as { deliveryId: string };
      const result = await deliveryService.acceptDelivery(request.user.id, deliveryId);
      return reply.status(200).send(result);
    }
  );

  fastify.post(
    "/riders/deliveries/:deliveryId/pickup",
    {
      preHandler: [authorize(["RIDER", "ADMIN"])],
      schema: {
        description: "Rider confirms food pickup from restaurant",
        tags: ["Delivery"],
        security: [{ bearerAuth: [] }],
        params: z.object({ deliveryId: z.string().uuid() }),
        response: {
          200: deliveryResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { deliveryId } = request.params as { deliveryId: string };
      const result = await deliveryService.pickupDelivery(request.user.id, deliveryId);
      return reply.status(200).send(result);
    }
  );

  fastify.post(
    "/riders/deliveries/:deliveryId/complete",
    {
      preHandler: [authorize(["RIDER", "ADMIN"])],
      schema: {
        description: "Rider confirms successful delivery to customer",
        tags: ["Delivery"],
        security: [{ bearerAuth: [] }],
        params: z.object({ deliveryId: z.string().uuid() }),
        response: {
          200: deliveryResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { deliveryId } = request.params as { deliveryId: string };
      const result = await deliveryService.completeDelivery(request.user.id, deliveryId);
      return reply.status(200).send(result);
    }
  );

  // Tracking endpoint (authorized Customer, Staff, Rider, or Admin)
  fastify.get(
    "/deliveries/:orderId/track",
    {
      schema: {
        description: "Track live delivery status, locations, and rider details",
        tags: ["Delivery"],
        security: [{ bearerAuth: [] }],
        params: z.object({ orderId: z.string().uuid() }),
        response: {
          200: deliveryTrackingResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { orderId } = request.params as { orderId: string };
      const tracking = await deliveryService.trackDelivery(
        orderId,
        request.user.id,
        request.user.role
      );
      return reply.status(200).send(tracking);
    }
  );
};

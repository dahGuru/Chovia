import type { FastifyPluginAsync } from "fastify";
import "../../types/auth.js";
import { deliveryService } from "./delivery.service.js";
import { updateRiderStatusSchema } from "./dto/delivery.dto.js";
import { authorize } from "../../plugins/auth-guard.js";

export const deliveryRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", fastify.authenticate);

  // Rider endpoints
  fastify.patch(
    "/riders/status",
    {
      preHandler: [authorize(["RIDER", "ADMIN"])],
      schema: {
        description: "Toggle rider online/offline availability status",
        tags: ["Delivery"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const body = updateRiderStatusSchema.parse(request.body);
      const result = await deliveryService.updateRiderStatus(request.user.id, body);
      return reply.status(200).send(result);
    }
  );

  fastify.get(
    "/riders/deliveries/available",
    {
      preHandler: [authorize(["RIDER", "ADMIN"])],
      schema: {
        description: "List available delivery assignments for riders",
        tags: ["Delivery"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const result = await deliveryService.getAvailableDeliveries(request.user.id);
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
      },
    },
    async (request, reply) => {
      const { deliveryId } = request.params as { deliveryId: string };
      const result = await deliveryService.completeDelivery(request.user.id, deliveryId);
      return reply.status(200).send(result);
    }
  );

  // Tracking endpoint (Customer, Staff, Rider, Admin)
  fastify.get(
    "/deliveries/:orderId/track",
    {
      schema: {
        description: "Track live delivery status, locations, and rider details",
        tags: ["Delivery"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { orderId } = request.params as { orderId: string };
      const tracking = await deliveryService.trackDelivery(orderId);
      return reply.status(200).send(tracking);
    }
  );
};

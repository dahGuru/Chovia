import type { FastifyPluginAsync } from "fastify";
import "../../types/auth.js";
import { notificationsService } from "./notifications.service.js";

export const notificationsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get(
    "/",
    {
      schema: {
        description: "List notifications for authenticated user",
        tags: ["Notifications"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const notifications = await notificationsService.list(request.user.id);
      return reply.status(200).send(notifications);
    }
  );

  fastify.patch(
    "/:id/read",
    {
      schema: {
        description: "Mark a notification as read",
        tags: ["Notifications"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = await notificationsService.markRead(request.user.id, id);
      return reply.status(200).send(result);
    }
  );

  fastify.patch(
    "/read-all",
    {
      schema: {
        description: "Mark all notifications as read for authenticated user",
        tags: ["Notifications"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const result = await notificationsService.markAllRead(request.user.id);
      return reply.status(200).send(result);
    }
  );
};

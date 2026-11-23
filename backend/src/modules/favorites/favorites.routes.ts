import type { FastifyPluginAsync } from "fastify";
import "../../types/auth.js";
import { favoritesService } from "./favorites.service.js";

export const favoritesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get(
    "/",
    {
      schema: {
        description: "List authenticated customer favorite menu items",
        tags: ["Favorites"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const favorites = await favoritesService.list(request.user.id);
      return reply.status(200).send(favorites);
    }
  );

  fastify.post(
    "/:menuItemId",
    {
      schema: {
        description: "Toggle favorite status for a menu item",
        tags: ["Favorites"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { menuItemId } = request.params as { menuItemId: string };
      const result = await favoritesService.toggleFavorite(request.user.id, menuItemId);
      return reply.status(200).send(result);
    }
  );
};

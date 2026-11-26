import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { menuService } from "./menu.service.js";
import {
  createCategoryRequestSchema,
  updateCategoryRequestSchema,
  createMenuItemRequestSchema,
  updateMenuItemRequestSchema,
  updateItemAvailabilityRequestSchema,
  categoryWithItemsResponseSchema,
} from "./dto/menu.dto.js";
import { requireRestaurantStaff } from "../../plugins/auth-guard.js";

export const menuRoutes: FastifyPluginAsync = async (fastify) => {
  // Public menu endpoint
  fastify.get(
    "/restaurants/:restaurantId/menu",
    {
      schema: {
        description: "Get full active menu for a restaurant organized by category",
        tags: ["Menu"],
        params: z.object({ restaurantId: z.string().uuid() }),
        response: {
          200: z.array(categoryWithItemsResponseSchema),
        },
      },
    },
    async (request, reply) => {
      const { restaurantId } = request.params as { restaurantId: string };
      const menu = await menuService.getRestaurantMenu(restaurantId);
      return reply.status(200).send(menu);
    }
  );

  // Categories management (Restaurant staff or Admin)
  fastify.post(
    "/restaurants/:restaurantId/categories",
    {
      preHandler: [fastify.authenticate, requireRestaurantStaff],
      schema: {
        description: "Create a new menu category",
        tags: ["Menu"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { restaurantId } = request.params as { restaurantId: string };
      const body = createCategoryRequestSchema.parse(request.body);
      const category = await menuService.createCategory(restaurantId, body);
      return reply.status(201).send(category);
    }
  );

  fastify.patch(
    "/restaurants/:restaurantId/categories/:categoryId",
    {
      preHandler: [fastify.authenticate, requireRestaurantStaff],
      schema: {
        description: "Update an existing menu category",
        tags: ["Menu"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { restaurantId, categoryId } = request.params as {
        restaurantId: string;
        categoryId: string;
      };
      const body = updateCategoryRequestSchema.parse(request.body);
      const category = await menuService.updateCategory(restaurantId, categoryId, body);
      return reply.status(200).send(category);
    }
  );

  fastify.delete(
    "/restaurants/:restaurantId/categories/:categoryId",
    {
      preHandler: [fastify.authenticate, requireRestaurantStaff],
      schema: {
        description: "Archive a menu category and its items",
        tags: ["Menu"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { restaurantId, categoryId } = request.params as {
        restaurantId: string;
        categoryId: string;
      };
      const result = await menuService.deleteCategory(restaurantId, categoryId);
      return reply.status(200).send(result);
    }
  );

  // Menu items management (Restaurant staff or Admin)
  fastify.post(
    "/restaurants/:restaurantId/items",
    {
      preHandler: [fastify.authenticate, requireRestaurantStaff],
      schema: {
        description: "Create a new menu item",
        tags: ["Menu"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { restaurantId } = request.params as { restaurantId: string };
      const body = createMenuItemRequestSchema.parse(request.body);
      const item = await menuService.createMenuItem(restaurantId, body);
      return reply.status(201).send(item);
    }
  );

  fastify.patch(
    "/restaurants/:restaurantId/items/:itemId",
    {
      preHandler: [fastify.authenticate, requireRestaurantStaff],
      schema: {
        description: "Update a menu item",
        tags: ["Menu"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { restaurantId, itemId } = request.params as {
        restaurantId: string;
        itemId: string;
      };
      const body = updateMenuItemRequestSchema.parse(request.body);
      const item = await menuService.updateMenuItem(restaurantId, itemId, body);
      return reply.status(200).send(item);
    }
  );

  fastify.patch(
    "/restaurants/:restaurantId/items/:itemId/availability",
    {
      preHandler: [fastify.authenticate, requireRestaurantStaff],
      schema: {
        description: "Toggle menu item availability",
        tags: ["Menu"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { restaurantId, itemId } = request.params as {
        restaurantId: string;
        itemId: string;
      };
      const body = updateItemAvailabilityRequestSchema.parse(request.body);
      const item = await menuService.toggleItemAvailability(
        restaurantId,
        itemId,
        body.availability
      );
      return reply.status(200).send(item);
    }
  );

  fastify.delete(
    "/restaurants/:restaurantId/items/:itemId",
    {
      preHandler: [fastify.authenticate, requireRestaurantStaff],
      schema: {
        description: "Archive a menu item",
        tags: ["Menu"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { restaurantId, itemId } = request.params as {
        restaurantId: string;
        itemId: string;
      };
      const result = await menuService.deleteMenuItem(restaurantId, itemId);
      return reply.status(200).send(result);
    }
  );
};

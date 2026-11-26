import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import "../../types/auth.js";
import { restaurantsService } from "./restaurants.service.js";
import {
  listRestaurantsQuerySchema,
  createRestaurantRequestSchema,
  updateRestaurantRequestSchema,
  updateAvailabilityRequestSchema,
  restaurantResponseSchema,
  paginatedRestaurantsResponseSchema,
} from "./dto/restaurant.dto.js";
import { requireRestaurantStaff } from "../../plugins/auth-guard.js";

export const restaurantsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/",
    {
      schema: {
        description: "List approved active restaurants with optional location and cuisine filters",
        tags: ["Restaurants"],
        querystring: listRestaurantsQuerySchema,
        response: {
          200: paginatedRestaurantsResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const query = listRestaurantsQuerySchema.parse(request.query);
      const result = await restaurantsService.list(query);
      return reply.status(200).send(result);
    }
  );

  fastify.get(
    "/:id",
    {
      schema: {
        description: "Get detailed restaurant information by ID",
        tags: ["Restaurants"],
        params: z.object({ id: z.string().uuid() }),
        querystring: z.object({
          lat: z.string().optional(),
          lng: z.string().optional(),
        }),
        response: {
          200: restaurantResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const q = request.query as { lat?: string; lng?: string };
      const parsedLat = q.lat !== undefined ? Number.parseFloat(q.lat) : Number.NaN;
      const parsedLng = q.lng !== undefined ? Number.parseFloat(q.lng) : Number.NaN;
      const userLoc =
        Number.isFinite(parsedLat) && Number.isFinite(parsedLng)
          ? { lat: parsedLat, lng: parsedLng }
          : undefined;

      const result = await restaurantsService.getById(id, userLoc);
      return reply.status(200).send(result);
    }
  );

  fastify.post(
    "/",
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: "Register a new restaurant (creates pending approval)",
        tags: ["Restaurants"],
        security: [{ bearerAuth: [] }],
        body: createRestaurantRequestSchema,
        response: {
          201: restaurantResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const body = createRestaurantRequestSchema.parse(request.body);
      const result = await restaurantsService.create(request.user.id, body);
      return reply.status(201).send(result);
    }
  );

  fastify.patch(
    "/:id",
    {
      preHandler: [fastify.authenticate, requireRestaurantStaff],
      schema: {
        description: "Update restaurant details (Staff or Admin only)",
        tags: ["Restaurants"],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: z.string().uuid() }),
        body: updateRestaurantRequestSchema,
        response: {
          200: restaurantResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = updateRestaurantRequestSchema.parse(request.body);
      const result = await restaurantsService.update(id, body);
      return reply.status(200).send(result);
    }
  );

  fastify.patch(
    "/:id/availability",
    {
      preHandler: [fastify.authenticate, requireRestaurantStaff],
      schema: {
        description: "Update restaurant open/closed status (Staff or Admin only)",
        tags: ["Restaurants"],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: z.string().uuid() }),
        body: updateAvailabilityRequestSchema,
        response: {
          200: restaurantResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = updateAvailabilityRequestSchema.parse(request.body);
      const result = await restaurantsService.updateAvailability(id, body);
      return reply.status(200).send(result);
    }
  );
};

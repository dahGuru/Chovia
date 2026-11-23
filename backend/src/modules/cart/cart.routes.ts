import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import "../../types/auth.js";
import { cartService } from "./cart.service.js";
import {
  addCartItemRequestSchema,
  updateCartItemRequestSchema,
  cartResponseSchema,
} from "./dto/cart.dto.js";

export const cartRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get(
    "/",
    {
      schema: {
        description: "Get authenticated customer cart with authoritative price calculations",
        tags: ["Cart"],
        security: [{ bearerAuth: [] }],
        querystring: z.object({
          addressId: z.string().uuid().optional(),
        }),
        response: {
          200: cartResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const q = request.query as { addressId?: string };
      const cart = await cartService.getCart(request.user.id, q.addressId);
      return reply.status(200).send(cart);
    }
  );

  fastify.post(
    "/items",
    {
      schema: {
        description: "Add item to customer cart (enforces one-restaurant rule)",
        tags: ["Cart"],
        security: [{ bearerAuth: [] }],
        body: addCartItemRequestSchema,
        response: {
          200: cartResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const body = addCartItemRequestSchema.parse(request.body);
      const cart = await cartService.addItem(request.user.id, body);
      return reply.status(200).send(cart);
    }
  );

  fastify.patch(
    "/items/:id",
    {
      schema: {
        description: "Update item quantity in cart",
        tags: ["Cart"],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: z.string().uuid() }),
        body: updateCartItemRequestSchema,
        response: {
          200: cartResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = updateCartItemRequestSchema.parse(request.body);
      const cart = await cartService.updateItemQuantity(request.user.id, id, body);
      return reply.status(200).send(cart);
    }
  );

  fastify.delete(
    "/items/:id",
    {
      schema: {
        description: "Remove item from cart",
        tags: ["Cart"],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: z.string().uuid() }),
        response: {
          200: cartResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const cart = await cartService.removeItem(request.user.id, id);
      return reply.status(200).send(cart);
    }
  );

  fastify.delete(
    "/",
    {
      schema: {
        description: "Clear all items from cart",
        tags: ["Cart"],
        security: [{ bearerAuth: [] }],
        response: {
          200: cartResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const cart = await cartService.clearCart(request.user.id);
      return reply.status(200).send(cart);
    }
  );
};

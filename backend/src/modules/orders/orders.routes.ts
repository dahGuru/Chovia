import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import "../../types/auth.js";
import { ordersService } from "./orders.service.js";
import {
  checkoutRequestSchema,
  cancelOrderRequestSchema,
  rejectOrderRequestSchema,
  listOrdersQuerySchema,
  orderResponseSchema,
  paginatedOrdersResponseSchema,
} from "./dto/order.dto.js";

export const ordersRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.post(
    "/checkout",
    {
      schema: {
        description: "Checkout cart into a formal order (with server-side pricing and idempotency)",
        tags: ["Orders"],
        security: [{ bearerAuth: [] }],
        body: checkoutRequestSchema,
        response: {
          201: orderResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const body = checkoutRequestSchema.parse(request.body);
      const order = await ordersService.checkout(request.user.id, body);
      return reply.status(201).send(order);
    }
  );

  fastify.get(
    "/",
    {
      schema: {
        description: "List orders scoped to authenticated customer, rider, restaurant staff, or admin",
        tags: ["Orders"],
        security: [{ bearerAuth: [] }],
        querystring: listOrdersQuerySchema,
        response: {
          200: paginatedOrdersResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const query = listOrdersQuerySchema.parse(request.query);
      const orders = await ordersService.list(request.user.id, request.user.role, query);
      return reply.status(200).send(orders);
    }
  );

  fastify.get(
    "/:id",
    {
      schema: {
        description: "Get complete details and status history of an order",
        tags: ["Orders"],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: z.string().uuid() }),
        response: {
          200: orderResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const order = await ordersService.getById(request.user.id, request.user.role, id);
      return reply.status(200).send(order);
    }
  );

  fastify.post(
    "/:id/cancel",
    {
      schema: {
        description: "Customer or Admin cancel order (before preparation)",
        tags: ["Orders"],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: z.string().uuid() }),
        body: cancelOrderRequestSchema,
        response: {
          200: orderResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = cancelOrderRequestSchema.parse(request.body);
      const order = await ordersService.cancelOrder(request.user.id, request.user.role, id, body);
      return reply.status(200).send(order);
    }
  );

  fastify.post(
    "/:id/accept",
    {
      schema: {
        description: "Restaurant accepts order and begins preparation",
        tags: ["Orders"],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: z.string().uuid() }),
        response: {
          200: orderResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const order = await ordersService.acceptOrder(request.user.id, id);
      return reply.status(200).send(order);
    }
  );

  fastify.post(
    "/:id/ready",
    {
      schema: {
        description: "Restaurant marks order as ready for pickup",
        tags: ["Orders"],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: z.string().uuid() }),
        response: {
          200: orderResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const order = await ordersService.markOrderReady(request.user.id, id);
      return reply.status(200).send(order);
    }
  );

  fastify.post(
    "/:id/reject",
    {
      schema: {
        description: "Restaurant rejects incoming order with reason",
        tags: ["Orders"],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: z.string().uuid() }),
        body: rejectOrderRequestSchema,
        response: {
          200: orderResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = rejectOrderRequestSchema.parse(request.body);
      const order = await ordersService.rejectOrder(request.user.id, id, body);
      return reply.status(200).send(order);
    }
  );
};

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import "../../types/auth.js";
import { addressesService } from "./addresses.service.js";
import {
  createAddressRequestSchema,
  updateAddressRequestSchema,
  addressResponseSchema,
} from "./dto/address.dto.js";

export const addressesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get(
    "/",
    {
      schema: {
        description: "List delivery addresses for authenticated customer",
        tags: ["Addresses"],
        security: [{ bearerAuth: [] }],
        response: {
          200: z.array(addressResponseSchema),
        },
      },
    },
    async (request, reply) => {
      const addresses = await addressesService.list(request.user.id);
      return reply.status(200).send(addresses);
    }
  );

  fastify.post(
    "/",
    {
      schema: {
        description: "Create a new saved delivery address",
        tags: ["Addresses"],
        security: [{ bearerAuth: [] }],
        body: createAddressRequestSchema,
        response: {
          201: addressResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const body = createAddressRequestSchema.parse(request.body);
      const address = await addressesService.create(request.user.id, body);
      return reply.status(201).send(address);
    }
  );

  fastify.patch(
    "/:id",
    {
      schema: {
        description: "Update a saved delivery address",
        tags: ["Addresses"],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: z.string().uuid() }),
        body: updateAddressRequestSchema,
        response: {
          200: addressResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = updateAddressRequestSchema.parse(request.body);
      const updated = await addressesService.update(request.user.id, id, body);
      return reply.status(200).send(updated);
    }
  );

  fastify.patch(
    "/:id/default",
    {
      schema: {
        description: "Set an address as customer default",
        tags: ["Addresses"],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: z.string().uuid() }),
        response: {
          200: addressResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const updated = await addressesService.setDefault(request.user.id, id);
      return reply.status(200).send(updated);
    }
  );

  fastify.delete(
    "/:id",
    {
      schema: {
        description: "Delete a saved delivery address",
        tags: ["Addresses"],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: z.string().uuid() }),
        response: {
          200: z.object({ message: z.string(), success: z.boolean() }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = await addressesService.delete(request.user.id, id);
      return reply.status(200).send(result);
    }
  );
};

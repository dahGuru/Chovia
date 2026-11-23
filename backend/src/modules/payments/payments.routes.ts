import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import "../../types/auth.js";
import { paymentsService } from "./payments.service.js";
import {
  initializePaymentRequestSchema,
  initializePaymentResponseSchema,
  verifyPaymentResponseSchema,
} from "./dto/payment.dto.js";
import { BadRequestError } from "../../common/errors/api-error.js";

export const paymentsRoutes: FastifyPluginAsync = async (fastify) => {
  // Public webhook handler from Paystack
  fastify.post(
    "/webhook",
    {
      config: {
        rawBody: true,
      },
      schema: {
        description: "Paystack webhook receiver (HMAC SHA-512 signature verified)",
        tags: ["Payments"],
        response: {
          200: z.object({ received: z.boolean() }),
        },
      },
    },
    async (request, reply) => {
      const signature = (request.headers["x-paystack-signature"] as string) || "";
      const rawBody = (request as unknown as { rawBody?: string | Buffer }).rawBody;

      if (!rawBody) {
        throw new BadRequestError("Missing raw body for webhook verification");
      }

      const result = await paymentsService.handleWebhook(rawBody, signature);
      return reply.status(200).send(result);
    }
  );

  // Authenticated endpoints
  fastify.post(
    "/initialize",
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: "Initialize Paystack checkout transaction for an order",
        tags: ["Payments"],
        security: [{ bearerAuth: [] }],
        body: initializePaymentRequestSchema,
        response: {
          200: initializePaymentResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const body = initializePaymentRequestSchema.parse(request.body);
      const result = await paymentsService.initializePayment(request.user.id, body);
      return reply.status(200).send(result);
    }
  );

  fastify.get(
    "/verify/:reference",
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: "Verify payment transaction status with Paystack",
        tags: ["Payments"],
        security: [{ bearerAuth: [] }],
        params: z.object({ reference: z.string().min(1) }),
        response: {
          200: verifyPaymentResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { reference } = request.params as { reference: string };
      const result = await paymentsService.verifyPayment(request.user.id, reference);
      return reply.status(200).send(result);
    }
  );
};

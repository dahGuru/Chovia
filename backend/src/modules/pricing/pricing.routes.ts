import type { FastifyPluginAsync } from "fastify";
import { pricingService } from "./pricing.service.js";
import {
  calculateEstimateRequestSchema,
  estimateResponseSchema,
} from "./dto/pricing.dto.js";

export const pricingRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    "/estimate",
    {
      schema: {
        description: "Calculate authoritative order estimate including distance delivery and platform fees",
        tags: ["Pricing"],
        body: calculateEstimateRequestSchema,
        response: {
          200: estimateResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const body = calculateEstimateRequestSchema.parse(request.body);
      const estimate = await pricingService.calculateEstimate(body);
      return reply.status(200).send(estimate);
    }
  );

  fastify.get(
    "/configs",
    {
      schema: {
        description: "Get active platform commission and delivery pricing tiers",
        tags: ["Pricing"],
      },
    },
    async (request, reply) => {
      const configs = await pricingService.getActiveConfigs();
      return reply.status(200).send(configs);
    }
  );
};

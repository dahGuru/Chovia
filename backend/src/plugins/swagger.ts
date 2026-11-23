import fp from "fastify-plugin";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import { jsonSchemaTransform } from "@fastify/type-provider-zod";
import type { FastifyPluginAsync } from "fastify";

const swaggerPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(fastifySwagger, {
    openapi: {
      openapi: "3.1.0",
      info: {
        title: "CHOVIA API",
        description: "Official Food Delivery Platform REST API Documentation",
        version: "1.0.0",
      },
      servers: [
        {
          url: "http://localhost:4000",
          description: "Local development server",
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
            description: "Provide JWT Access Token obtained from /api/v1/auth/login",
          },
        },
        schemas: {
          ErrorResponse: {
            type: "object",
            required: ["statusCode", "code", "message", "timestamp"],
            properties: {
              statusCode: { type: "integer", example: 400 },
              code: { type: "string", example: "BAD_REQUEST" },
              message: { type: "string", example: "Invalid request payload" },
              details: { type: "object", nullable: true },
              timestamp: { type: "string", format: "date-time" },
            },
          },
          ValidationError: {
            type: "object",
            required: ["statusCode", "code", "message", "details", "timestamp"],
            properties: {
              statusCode: { type: "integer", example: 400 },
              code: { type: "string", example: "VALIDATION_ERROR" },
              message: { type: "string", example: "Request validation failed" },
              details: {
                type: "array",
                items: {
                  type: "object",
                  required: ["path", "message"],
                  properties: {
                    path: { type: "string", example: "email" },
                    message: { type: "string", example: "Invalid email address" },
                  },
                },
              },
              timestamp: { type: "string", format: "date-time" },
            },
          },
          PaginationMeta: {
            type: "object",
            required: ["total", "page", "limit", "totalPages"],
            properties: {
              total: { type: "integer", example: 42 },
              page: { type: "integer", example: 1 },
              limit: { type: "integer", example: 10 },
              totalPages: { type: "integer", example: 5 },
            },
          },
          HealthStatusResponse: {
            type: "object",
            required: ["status", "database", "redis", "environment", "timestamp"],
            properties: {
              status: { type: "string", example: "ok" },
              database: { type: "string", example: "connected" },
              redis: { type: "string", example: "connected" },
              environment: { type: "string", example: "development" },
              timestamp: { type: "string", format: "date-time" },
            },
          },
        },
      },
      security: [
        {
          bearerAuth: [],
        },
      ],
    },
    transform: jsonSchemaTransform,
  });

  await fastify.register(fastifySwaggerUi, {
    routePrefix: "/api/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
    },
    staticCSP: true,
  });
};

export default fp(swaggerPlugin, {
  name: "swagger-docs",
});

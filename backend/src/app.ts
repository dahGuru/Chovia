import Fastify, { type FastifyError } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import fastifyRawBody from "fastify-raw-body";
import {
  validatorCompiler,
  serializerCompiler,
  isResponseSerializationError,
} from "@fastify/type-provider-zod";
import { z, ZodError } from "zod";

import "./types/auth.js";
import { env } from "./config/env.js";
import jwtPlugin from "./plugins/jwt.js";
import swaggerPlugin from "./plugins/swagger.js";
import { AppError } from "./common/errors/api-error.js";
import { checkDatabaseConnection } from "./database/prisma.js";
import { redis, checkRedisConnection } from "./cache/redis.js";
import { sentryService } from "./integrations/sentry/sentry.service.js";

// Modules
import { authRoutes } from "./modules/auth/auth.routes.js";
import { usersRoutes } from "./modules/users/users.routes.js";
import { restaurantsRoutes } from "./modules/restaurants/restaurants.routes.js";
import { restaurantStaffRoutes } from "./modules/restaurant-staff/restaurant-staff.routes.js";
import { menuRoutes } from "./modules/menu/menu.routes.js";
import { addressesRoutes } from "./modules/addresses/addresses.routes.js";
import { cartRoutes } from "./modules/cart/cart.routes.js";
import { ordersRoutes } from "./modules/orders/orders.routes.js";
import { paymentsRoutes } from "./modules/payments/payments.routes.js";
import { deliveryRoutes } from "./modules/delivery/delivery.routes.js";
import { notificationsRoutes } from "./modules/notifications/notifications.routes.js";
import { pricingRoutes } from "./modules/pricing/pricing.routes.js";
import { adminRoutes } from "./modules/admin/admin.routes.js";
import { favoritesRoutes } from "./modules/favorites/favorites.routes.js";

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "production" ? "info" : "debug",
    },
  });

  // 1. Zod Type Provider Compilers
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // 2. Raw Body Plugin (for authentic webhook verification)
  await app.register(fastifyRawBody, {
    field: "rawBody",
    global: false,
    encoding: "utf8",
    runFirst: true,
  });

  // 3. Core Security Plugins
  const allowedOrigins = env.CORS_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean);
  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      if (allowedOrigins.includes("*") && env.NODE_ENV !== "production") return cb(null, true);
      cb(new Error("Not allowed by CORS"), false);
    },
    credentials: true,
  });

  await app.register(helmet, {
    contentSecurityPolicy: false, // Allows Swagger UI to render properly
  });

  const isDistributedRateLimit = env.NODE_ENV === "production" || env.NODE_ENV === "staging";
  await app.register(rateLimit, {
    max: 200,
    timeWindow: "1 minute",
    ...(isDistributedRateLimit ? { redis } : {}),
  });

  // 4. Authentication & OpenAPI
  await app.register(jwtPlugin);
  await app.register(swaggerPlugin);

  // 5. Centralized Error Handler
  app.setErrorHandler((error: FastifyError | AppError | ZodError | Error, request, reply) => {
    const timestamp = new Date().toISOString();

    if (error instanceof ZodError) {
      return reply.status(400).send({
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
        timestamp,
      });
    }

    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        statusCode: error.statusCode,
        code: error.code,
        message: error.message,
        details: error.details,
        timestamp,
      });
    }

    if (isResponseSerializationError(error)) {
      const issues = error.cause.issues.map((issue) => {
        const entry: {
          path: string;
          code: string;
          message: string;
          expected?: string;
          received?: string;
        } = {
          path: issue.path.length > 0 ? issue.path.join(".") : "<root>",
          code: String(issue.code),
          message: issue.message,
        };
        if ("expected" in issue && issue.expected !== undefined) {
          entry.expected = String(issue.expected);
        }
        if ("received" in issue && issue.received !== undefined) {
          entry.received = String(issue.received);
        }
        return entry;
      });

      const endpoint = `${error.method} ${error.url}`;
      request.log.error(
        {
          endpoint,
          issues,
        },
        "Response schema serialization mismatch"
      );

      sentryService.captureException(error, {
        endpoint,
        issues,
      });

      return reply.status(500).send({
        statusCode: 500,
        code: "RESPONSE_VALIDATION_ERROR",
        message: "Server response contract mismatch",
        ...(env.NODE_ENV !== "production" ? { details: { endpoint, issues } } : {}),
        timestamp,
      });
    }

    // Fastify native schema validation error
    if ("validation" in error && error.validation) {
      return reply.status(400).send({
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: error.message,
        details: error.validation,
        timestamp,
      });
    }

    request.log.error(error);

    // Capture unhandled 500 errors to Sentry
    sentryService.captureException(error, {
      url: request.url,
      method: request.method,
      ip: request.ip,
    });

    return reply.status(500).send({
      statusCode: 500,
      code: "INTERNAL_SERVER_ERROR",
      message:
        env.NODE_ENV === "production"
          ? "An unexpected error occurred"
          : error.message || "An unexpected error occurred",
      timestamp,
    });
  });

  // 6. Health Checks: Liveness, Readiness & Infrastructure Connectivity
  app.get(
    "/health/live",
    {
      schema: {
        description: "Application Liveness Probe (checks process uptime)",
        tags: ["Health"],
        response: {
          200: z.object({
            status: z.string(),
            uptime: z.number(),
            timestamp: z.string(),
          }),
        },
      },
    },
    async (_request, reply) => {
      return reply.status(200).send({
        status: "alive",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      });
    }
  );

  app.get(
    "/health/ready",
    {
      schema: {
        description: "Application Readiness Probe (verifies PostgreSQL and Redis)",
        tags: ["Health"],
        response: {
          200: z.object({
            status: z.string(),
            database: z.string(),
            redis: z.string(),
            environment: z.string(),
            timestamp: z.string(),
          }),
          503: z.object({
            status: z.string(),
            database: z.string(),
            redis: z.string(),
            environment: z.string(),
            timestamp: z.string(),
          }),
        },
      },
    },
    async (_request, reply) => {
      const dbConnected = await checkDatabaseConnection();
      const redisConnected = await checkRedisConnection();
      const isReady = dbConnected && redisConnected;

      return reply.status(isReady ? 200 : 503).send({
        status: isReady ? "ready" : "unready",
        database: dbConnected ? "connected" : "disconnected",
        redis: redisConnected ? "connected" : "disconnected",
        environment: env.NODE_ENV,
        timestamp: new Date().toISOString(),
      });
    }
  );

  app.get(
    "/health",
    {
      schema: {
        description: "API Health & Infrastructure Connectivity Status Check",
        tags: ["Health"],
        response: {
          200: z.object({
            status: z.string(),
            database: z.string(),
            redis: z.string(),
            environment: z.string(),
            timestamp: z.string(),
          }),
        },
      },
    },
    async (_request, reply) => {
      const dbConnected = await checkDatabaseConnection();
      const redisConnected = await checkRedisConnection();
      const isHealthy = dbConnected && redisConnected;

      return reply.status(200).send({
        status: isHealthy ? "ok" : "degraded",
        database: dbConnected ? "connected" : "disconnected",
        redis: redisConnected ? "connected" : "disconnected",
        environment: env.NODE_ENV,
        timestamp: new Date().toISOString(),
      });
    }
  );

  // 7. Register Domain Routes under /api/v1
  await app.register(
    async (v1) => {
      await v1.register(authRoutes, { prefix: "/auth" });
      await v1.register(usersRoutes, { prefix: "/users" });
      await v1.register(restaurantsRoutes, { prefix: "/restaurants" });
      await v1.register(restaurantStaffRoutes, { prefix: "/staff" });
      await v1.register(menuRoutes);
      await v1.register(addressesRoutes, { prefix: "/addresses" });
      await v1.register(cartRoutes, { prefix: "/cart" });
      await v1.register(ordersRoutes, { prefix: "/orders" });
      await v1.register(paymentsRoutes, { prefix: "/payments" });
      await v1.register(deliveryRoutes);
      await v1.register(notificationsRoutes, { prefix: "/notifications" });
      await v1.register(pricingRoutes, { prefix: "/pricing" });
      await v1.register(adminRoutes, { prefix: "/admin" });
      await v1.register(favoritesRoutes, { prefix: "/favorites" });
    },
    { prefix: "/api/v1" }
  );

  return app;
}

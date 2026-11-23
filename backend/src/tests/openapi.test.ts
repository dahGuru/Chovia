import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import yaml from "yaml";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../../../");
const apiOpenApiDir = path.resolve(rootDir, "api/openapi");

interface OpenApiSpec {
  openapi: string;
  info: {
    title: string;
    version: string;
  };
  components?: {
    securitySchemes?: {
      bearerAuth?: {
        type: string;
        scheme: string;
        bearerFormat?: string;
      };
    };
  };
  paths: Record<
    string,
    Record<
      string,
      {
        summary?: string;
        description?: string;
        parameters?: unknown[];
        requestBody?: {
          content?: Record<string, { schema?: unknown }>;
        };
        responses?: Record<string, unknown>;
      }
    >
  >;
}

describe("OpenAPI 3.1 Contract & Automated Verification", () => {
  let app: FastifyInstance;
  let spec: OpenApiSpec;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    spec = app.swagger() as unknown as OpenApiSpec;
  }, 15000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it("should declare OpenAPI version 3.1.0 with complete metadata", () => {
    expect(spec.openapi).toBe("3.1.0");
    expect(spec.info).toBeDefined();
    expect(spec.info.title).toBe("CHOVIA API");
    expect(spec.info.version).toBe("1.0.0");
  });

  it("should define JWT Bearer authentication in components.securitySchemes", () => {
    expect(spec.components?.securitySchemes).toBeDefined();
    const bearer = spec.components.securitySchemes.bearerAuth;
    expect(bearer).toBeDefined();
    expect(bearer.type).toBe("http");
    expect(bearer.scheme).toBe("bearer");
    expect(bearer.bearerFormat).toBe("JWT");
  });

  it("should have matching JSON and YAML specifications on disk", async () => {
    const jsonPath = path.join(apiOpenApiDir, "openapi.json");
    const yamlPath = path.join(apiOpenApiDir, "openapi.yaml");

    const jsonRaw = await fs.readFile(jsonPath, "utf8");
    const yamlRaw = await fs.readFile(yamlPath, "utf8");

    const parsedJson = JSON.parse(jsonRaw);
    const parsedYaml = yaml.parse(yamlRaw);

    expect(parsedJson.openapi).toBe("3.1.0");
    expect(parsedYaml.openapi).toBe("3.1.0");
    expect(parsedYaml.info.title).toBe(parsedJson.info.title);
    expect(Object.keys(parsedYaml.paths).length).toBe(Object.keys(parsedJson.paths).length);
  });

  it("should cover all primary domain routes across authentication, payments, orders, and users", () => {
    const paths = spec.paths;
    const requiredEndpoints = [
      "/health/live",
      "/health/ready",
      "/health",
      "/api/v1/auth/register",
      "/api/v1/auth/login",
      "/api/v1/auth/refresh",
      "/api/v1/auth/logout",
      "/api/v1/auth/verify-email/verify",
      "/api/v1/users/profile",
      "/api/v1/users/upload-signature",
      "/api/v1/users/upload-image",
      "/api/v1/restaurants/",
      "/api/v1/cart/",
      "/api/v1/cart/items",
      "/api/v1/orders/",
      "/api/v1/orders/checkout",
      "/api/v1/payments/initialize",
      "/api/v1/payments/verify/{reference}",
      "/api/v1/payments/webhook",
      "/api/v1/addresses/",
      "/api/v1/pricing/estimate",
    ];

    for (const endpoint of requiredEndpoints) {
      expect(paths[endpoint], `Missing endpoint in OpenAPI contract: ${endpoint}`).toBeDefined();
    }
  });

  it("should attach request body schemas for state-mutating endpoints", () => {
    const paths = spec.paths;
    const bodyEndpoints: Array<{ path: string; method: string }> = [
      { path: "/api/v1/auth/register", method: "post" },
      { path: "/api/v1/auth/login", method: "post" },
      { path: "/api/v1/orders/checkout", method: "post" },
      { path: "/api/v1/payments/initialize", method: "post" },
      { path: "/api/v1/cart/items", method: "post" },
      { path: "/api/v1/pricing/estimate", method: "post" },
      { path: "/api/v1/users/upload-signature", method: "post" },
    ];

    for (const { path: routePath, method } of bodyEndpoints) {
      const operation = paths[routePath]?.[method];
      expect(operation, `Missing operation ${method.toUpperCase()} ${routePath}`).toBeDefined();
      expect(operation.requestBody, `Missing requestBody for ${method.toUpperCase()} ${routePath}`).toBeDefined();
      expect(operation.requestBody.content?.["application/json"]?.schema).toBeDefined();
    }
  });

  it("should define responses for documented operations without broken references", () => {
    const paths = spec.paths;
    for (const [routePath, methods] of Object.entries(paths)) {
      for (const [method, operation] of Object.entries(methods)) {
        if (typeof operation === "object" && operation !== null && operation.responses) {
          expect(Object.keys(operation.responses).length, `Operation ${method.toUpperCase()} ${routePath} has no responses`).toBeGreaterThan(0);
        }
      }
    }
  });
});

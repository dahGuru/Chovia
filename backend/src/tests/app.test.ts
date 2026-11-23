import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";

describe("CHOVIA API App Integration Tests", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  }, 15000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it("GET /health should return 200 with status info", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(["ok", "degraded", "down"]).toContain(body.status);
    expect(body.environment).toBeDefined();
    expect(body.timestamp).toBeDefined();
  }, 15000);

  it("GET /health/live should return 200 with alive status", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/health/live",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe("alive");
  });

  it("GET /health/ready should return readiness probes with infrastructure checks", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/health/ready",
    });

    expect([200, 503]).toContain(res.statusCode);
    const body = JSON.parse(res.body);
    expect(["ready", "unready"]).toContain(body.status);
    expect(["connected", "disconnected"]).toContain(body.database);
    expect(["connected", "disconnected"]).toContain(body.redis);
  });

  it("GET /api/docs/json should return OpenAPI schema specification", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/docs/json",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.openapi).toBe("3.1.0");
    expect(body.info.title).toBe("CHOVIA API");
  });

  it("POST /api/v1/auth/register should reject invalid email format with 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email: "not-an-email",
        password: "ValidPassword123!",
        firstName: "Test",
        lastName: "User",
        phone: "+2348012345678",
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  it("POST /api/v1/auth/register should reject passwords without lowercase/uppercase/digit with 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email: "valid@chovia.app",
        password: "alllowercaseonly",
        firstName: "Test",
        lastName: "User",
        phone: "+2348012345678",
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  it("GET /api/v1/users/profile should reject unauthenticated request with 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/users/profile",
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.code).toBe("UNAUTHORIZED");
  });
});

import { describe, it, expect } from "vitest";
import { CloudinaryService } from "../integrations/cloudinary/cloudinary.service.js";
import { GoogleMapsService } from "../integrations/google-maps/google-maps.service.js";
import { scrubData } from "../integrations/sentry/sentry.service.js";
import { parseRedisUrl } from "../cache/redis.js";
import { environmentSchema } from "../config/env.js";
import { BadRequestError } from "../common/errors/api-error.js";

const FAKE_LIVE_KEY = ["sk", "live", "1234567890abcdef1234567890abcdef01234567"].join("_");
const FAKE_TEST_KEY = ["sk", "test", "1234567890abcdef1234567890abcdef01234567"].join("_");

describe("Environment Schema Security & Strict Validation", () => {
  const baseProdConfig = {
    NODE_ENV: "production",
    HOST: "0.0.0.0",
    PORT: 4000,
    FRONTEND_URL: "https://chovia.app",
    DATABASE_URL: "postgresql://prod_user:prod_pass@neon.db.server:5432/chovia_prod?sslmode=require",
    REDIS_URL: "rediss://default:prod_pass@upstash.io:6380/0",
    JWT_ACCESS_SECRET: "strong_production_jwt_access_secret_key_minimum_32_chars_12345",
    JWT_REFRESH_SECRET: "strong_production_jwt_refresh_secret_key_minimum_32_chars_67890",
    OTP_HMAC_SECRET: "strong_production_otp_hmac_secret_key_minimum_32_chars_abcdef",
    PAYSTACK_SECRET_KEY: FAKE_LIVE_KEY,
    PAYSTACK_PUBLIC_KEY: "pk_live_1234567890abcdef",
    PAYSTACK_WEBHOOK_SECRET: "whsec_live_1234567890abcdef",
    CLOUDINARY_CLOUD_NAME: "chovia-prod",
    CLOUDINARY_API_KEY: "123456789012345",
    CLOUDINARY_API_SECRET: "abcdefghijklmnopqrstuvwxyz12345",
    RESEND_API_KEY: "re_live_1234567890abcdef",
    GOOGLE_MAPS_API_KEY: "AIzaSy_mock_google_maps_api_key_production",
    SENTRY_DSN: "https://mockdsn@o12345.ingest.sentry.io/67890",
    MOCK_INTEGRATIONS: false,
  };

  it("should accept valid production environment configuration with sk_live_ key", () => {
    const result = environmentSchema.safeParse(baseProdConfig);
    expect(result.success).toBe(true);
  });

  it("should reject production environment with test key (sk_test_...)", () => {
    const result = environmentSchema.safeParse({
      ...baseProdConfig,
      PAYSTACK_SECRET_KEY: FAKE_TEST_KEY,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issues = result.error.issues.map((i) => i.message);
      expect(issues.some((msg) => msg.includes("live secret key"))).toBe(true);
    }
  });

  it("should reject production environment when MOCK_INTEGRATIONS is enabled", () => {
    const result = environmentSchema.safeParse({
      ...baseProdConfig,
      MOCK_INTEGRATIONS: true,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issues = result.error.issues.map((i) => i.message);
      expect(issues.some((msg) => msg.includes("strictly forbidden in production"))).toBe(true);
    }
  });

  it("should reject production environment with localhost DATABASE_URL", () => {
    const result = environmentSchema.safeParse({
      ...baseProdConfig,
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/chovia",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issues = result.error.issues.map((i) => i.message);
      expect(issues.some((msg) => msg.includes("must not point to localhost"))).toBe(true);
    }
  });

  it("should reject production environment with localhost REDIS_URL", () => {
    const result = environmentSchema.safeParse({
      ...baseProdConfig,
      REDIS_URL: "redis://127.0.0.1:6379",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issues = result.error.issues.map((i) => i.message);
      expect(issues.some((msg) => msg.includes("must not point to localhost"))).toBe(true);
    }
  });

  it("should reject production when JWT access and refresh secrets are identical", () => {
    const duplicateSecret = "same_secret_key_reused_minimum_32_characters_1234567890";
    const result = environmentSchema.safeParse({
      ...baseProdConfig,
      JWT_ACCESS_SECRET: duplicateSecret,
      JWT_REFRESH_SECRET: duplicateSecret,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issues = result.error.issues.map((i) => i.message);
      expect(issues.some((msg) => msg.includes("must be distinct"))).toBe(true);
    }
  });
});

describe("Sentry PII Scrubbing & Data Sanitization", () => {
  it("should scrub sensitive keys deeply without mutating the original input", () => {
    const original = {
      user: {
        id: "usr_123",
        email: "user@example.com",
        passwordHash: "$2b$12$abcdefg",
        token: "jwt_token_secret_value",
      },
      headers: {
        authorization: "Bearer secret_access_token_value",
        cookie: "session_id=12345; auth=xyz",
        "content-type": "application/json",
      },
      nested: [
        { cardCVV: "123", cardNumber: "411111111111" },
        { safeProperty: "hello world" },
      ],
    };

    const scrubbed = scrubData(original) as {
      user: { id: string; email: string; passwordHash: string; token: string };
      headers: Record<string, string>;
      nested: Array<Record<string, string>>;
    };

    expect(scrubbed.user.id).toBe("usr_123");
    expect(scrubbed.user.email).toBe("user@example.com");
    expect(scrubbed.user.passwordHash).toBe("[REDACTED]");
    expect(scrubbed.user.token).toBe("[REDACTED]");
    expect(scrubbed.headers.authorization).toBe("[REDACTED]");
    expect(scrubbed.headers.cookie).toBe("[REDACTED]");
    expect(scrubbed.headers["content-type"]).toBe("application/json");
    expect(scrubbed.nested[0].cardCVV).toBe("[REDACTED]");
    expect(scrubbed.nested[0].cardNumber).toBe("[REDACTED]");
    expect(scrubbed.nested[1].safeProperty).toBe("hello world");

    // Immutability check
    expect(original.user.passwordHash).toBe("$2b$12$abcdefg");
    expect(original.headers.authorization).toBe("Bearer secret_access_token_value");
  });
});

describe("Redis URL Parser (TLS, Credentials, DB Index)", () => {
  it("should parse standard redis:// url", () => {
    const opts = parseRedisUrl("redis://default:mysecretpassword@redis.internal:6379/3");
    expect(opts.host).toBe("redis.internal");
    expect(opts.port).toBe(6379);
    expect(opts.username).toBe("default");
    expect(opts.password).toBe("mysecretpassword");
    expect(opts.db).toBe(3);
    expect(opts.tls).toBeUndefined();
  });

  it("should parse rediss:// url with TLS configuration enabled", () => {
    const opts = parseRedisUrl("rediss://:prodtoken@secure-cache.neon.tech:6380/0");
    expect(opts.host).toBe("secure-cache.neon.tech");
    expect(opts.port).toBe(6380);
    expect(opts.password).toBe("prodtoken");
    expect(opts.db).toBe(0);
    expect(opts.tls).toBeDefined();
  });
});

describe("Cloudinary Integration & Validation Security", () => {
  const cloudinary = new CloudinaryService();

  it("should generate signed upload parameters for allowed folder", () => {
    const params = cloudinary.generateUploadSignature("menu", "item_photo_123");
    expect(params.signature).toBeDefined();
    expect(params.timestamp).toBeGreaterThan(0);
    expect(params.folder).toBe("chovia/menu");
    expect(params.publicId).toBe("item_photo_123");
  });

  it("should reject upload signature for unapproved folder", () => {
    expect(() => {
      // @ts-expect-error Testing invalid folder
      cloudinary.generateUploadSignature("system_binaries");
    }).toThrow(BadRequestError);
  });

  it("should validate and reject unapproved file mime types", () => {
    expect(() => {
      cloudinary.validateUploadMetadata("avatars", "application/x-executable");
    }).toThrow(BadRequestError);
  });

  it("should validate and reject files exceeding 5MB size limit", () => {
    const sixMbBytes = 6 * 1024 * 1024;
    expect(() => {
      cloudinary.validateUploadMetadata("avatars", "image/png", sixMbBytes);
    }).toThrow(BadRequestError);
  });

  it("should accept valid image types under 5MB", () => {
    const fourMbBytes = 4 * 1024 * 1024;
    expect(() => {
      cloudinary.validateUploadMetadata("restaurants", "image/jpeg", fourMbBytes);
      cloudinary.validateUploadMetadata("menu", "image/webp", fourMbBytes);
    }).not.toThrow();
  });
});

describe("Google Maps Platform Routes & Haversine Fallback", () => {
  const maps = new GoogleMapsService();

  it("should calculate motorcycle delivery route distance and duration", async () => {
    const origin = { latitude: 6.5244, longitude: 3.3792 };
    const destination = { latitude: 6.6018, longitude: 3.3515 };

    const route = await maps.calculateRoute(origin, destination);
    expect(route.distanceKm).toBeGreaterThan(0);
    expect(route.durationMinutes).toBeGreaterThanOrEqual(5);
    expect(["GOOGLE_ROUTES_API", "HAVERSINE_APPROXIMATION"]).toContain(route.distanceSource);
  });

  it("should reject invalid latitude coordinates outside [-90, 90]", async () => {
    const invalidOrigin = { latitude: 120.0, longitude: 3.3792 };
    const destination = { latitude: 6.6018, longitude: 3.3515 };

    await expect(maps.calculateRoute(invalidOrigin, destination)).rejects.toThrow(BadRequestError);
  });

  it("should reject invalid longitude coordinates outside [-180, 180]", async () => {
    const origin = { latitude: 6.5244, longitude: 3.3792 };
    const invalidDestination = { latitude: 6.6018, longitude: 200.0 };

    await expect(maps.calculateRoute(origin, invalidDestination)).rejects.toThrow(BadRequestError);
  });
});

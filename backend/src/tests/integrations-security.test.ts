/* eslint-disable @typescript-eslint/no-explicit-any */
import dns from "node:dns/promises";
import { describe, it, expect, vi } from "vitest";
import { CloudinaryService, inspectFileMagicBytes } from "../integrations/cloudinary/cloudinary.service.js";
import { GoogleMapsService } from "../integrations/google-maps/google-maps.service.js";
import { scrubData, sanitizeString } from "../integrations/sentry/sentry.service.js";
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
    KYC_ENCRYPTION_KEY: "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210",
    PAYSTACK_SECRET_KEY: FAKE_LIVE_KEY,
    PAYSTACK_PUBLIC_KEY: "pk_live_1234567890abcdef",
    PAYSTACK_WEBHOOK_SECRET: "whsec_live_1234567890abcdef",
    CLOUDINARY_CLOUD_NAME: "chovia-prod",
    CLOUDINARY_API_KEY: "123456789012345",
    CLOUDINARY_API_SECRET: "abcdefghijklmnopqrstuvwxyz12345",
    RESEND_API_KEY: "re_live_1234567890abcdef",
    GOOGLE_MAPS_API_KEY: "AIzaSy_mock_google_maps_api_key_production",
    SENTRY_DSN: "https://mockdsn@o12345.ingest.sentry.io/67890",
    EXPO_ACCESS_TOKEN: "mock_expo_access_token_12345",
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

  it("should accept valid staging environment configuration", () => {
    const stagingConfig = {
      ...baseProdConfig,
      NODE_ENV: "staging",
      FRONTEND_URL: "https://staging.chovia.app",
      PAYSTACK_SECRET_KEY: FAKE_TEST_KEY,
    };
    const result = environmentSchema.safeParse(stagingConfig);
    expect(result.success).toBe(true);
  });

  it("should reject staging environment when MOCK_INTEGRATIONS is enabled", () => {
    const result = environmentSchema.safeParse({
      ...baseProdConfig,
      NODE_ENV: "staging",
      MOCK_INTEGRATIONS: true,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issues = result.error.issues.map((i) => i.message);
      expect(issues.some((msg) => msg.includes("strictly forbidden in staging"))).toBe(true);
    }
  });

  it("should reject staging environment with localhost DATABASE_URL or REDIS_URL", () => {
    const dbResult = environmentSchema.safeParse({
      ...baseProdConfig,
      NODE_ENV: "staging",
      DATABASE_URL: "postgresql://localhost:5432/chovia",
    });
    expect(dbResult.success).toBe(false);

    const redisResult = environmentSchema.safeParse({
      ...baseProdConfig,
      NODE_ENV: "staging",
      REDIS_URL: "redis://127.0.0.1:6379",
    });
    expect(redisResult.success).toBe(false);
  });

  it("should enforce TLS rediss:// protocol for REDIS_URL in production and staging", () => {
    const prodPlainRedis = environmentSchema.safeParse({
      ...baseProdConfig,
      REDIS_URL: "redis://default:prod_pass@upstash.io:6379/0",
    });
    expect(prodPlainRedis.success).toBe(false);
    if (!prodPlainRedis.success) {
      expect(prodPlainRedis.error.issues.some((i) => i.message.includes("rediss://"))).toBe(true);
    }

    const stagingPlainRedis = environmentSchema.safeParse({
      ...baseProdConfig,
      NODE_ENV: "staging",
      REDIS_URL: "redis://default:staging_pass@upstash.io:6379/0",
    });
    expect(stagingPlainRedis.success).toBe(false);
    if (!stagingPlainRedis.success) {
      expect(stagingPlainRedis.error.issues.some((i) => i.message.includes("rediss://"))).toBe(true);
    }
  });

  it("should reject IPv6 loopback addresses for DATABASE_URL and REDIS_URL in production", () => {
    const dbIpv6 = environmentSchema.safeParse({
      ...baseProdConfig,
      DATABASE_URL: "postgresql://user:pass@[::1]:5432/db",
    });
    expect(dbIpv6.success).toBe(false);

    const redisIpv6 = environmentSchema.safeParse({
      ...baseProdConfig,
      REDIS_URL: "rediss://default:pass@[::1]:6380/0",
    });
    expect(redisIpv6.success).toBe(false);
  });

  it("should require EXPO_ACCESS_TOKEN in production and staging", () => {
    const prodNoExpo = environmentSchema.safeParse({
      ...baseProdConfig,
      EXPO_ACCESS_TOKEN: "",
    });
    expect(prodNoExpo.success).toBe(false);

    const stagingNoExpo = environmentSchema.safeParse({
      ...baseProdConfig,
      NODE_ENV: "staging",
      EXPO_ACCESS_TOKEN: "",
    });
    expect(stagingNoExpo.success).toBe(false);
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

  it("should sanitize strings by scrubbing embedded secrets, tokens, and URLs", () => {
    const rawString = "User authorization failed: Bearer secret_bearer_token_123456";
    expect(sanitizeString(rawString)).toBe("User authorization failed: Bearer [REDACTED]");

    const rawJwt = "Token expired: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.do_not_leak_signature";
    expect(sanitizeString(rawJwt)).toBe("Token expired: [REDACTED_JWT]");

    const rawUrl = "Database connection failed at postgresql://chovia_admin:supersecretpassword@neon.tech:5432/db";
    expect(sanitizeString(rawUrl)).toBe("Database connection failed at postgresql://chovia_admin:[REDACTED]@neon.tech:5432/db");

    const rawKey = "Paystack rejected key: sk_live_1234567890abcdef1234567890";
    expect(sanitizeString(rawKey)).toBe("Paystack rejected key: sk_live_[REDACTED]");
  });

  it("should safely handle circular references without stack overflow crashes", () => {
    const circularObj: any = { name: "Safe Name", secret: "super_secret_value" };
    circularObj.self = circularObj;

    const scrubbed = scrubData(circularObj) as any;
    expect(scrubbed.name).toBe("Safe Name");
    expect(scrubbed.secret).toBe("[REDACTED]");
    expect(scrubbed.self).toBe("[CIRCULAR]");
  });

  it("should bound deep recursion at depth 10 without exceeding stack", () => {
    let deep: any = { value: "deep_end" };
    for (let i = 0; i < 15; i++) {
      deep = { nested: deep };
    }

    const scrubbed = scrubData(deep) as any;
    expect(scrubbed).toBeDefined();

    // Traversal down 10 levels should hit [MAX_DEPTH_EXCEEDED]
    let cur = scrubbed;
    let depth = 0;
    while (cur && typeof cur === "object" && cur.nested) {
      cur = cur.nested;
      depth++;
    }
    expect(depth).toBe(10);
    expect(cur).toBe("[MAX_DEPTH_EXCEEDED]");
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

  it("should reject non-redis protocols and invalid configurations with explicit errors", () => {
    expect(() => parseRedisUrl("http://localhost:6379")).toThrow(/Unsupported Redis protocol/i);
    expect(() => parseRedisUrl("postgres://localhost:5432/db")).toThrow(/Unsupported Redis protocol/i);
    expect(() => parseRedisUrl("redis://")).toThrow(/missing valid hostname/i);
    expect(() => parseRedisUrl("redis://localhost:99999")).toThrow(/Malformed Redis URL|Invalid Redis port/i);
    expect(() => parseRedisUrl("redis://localhost:-5")).toThrow(/Malformed Redis URL|Invalid Redis port/i);
    expect(() => parseRedisUrl("redis://localhost:6379/99")).toThrow(/database index 99 out of valid range/i);
    expect(() => parseRedisUrl("redis://localhost:6379/notanumber")).toThrow(/Must be a numeric database index/i);
    expect(() => parseRedisUrl("redis://redis.internal:6379?arbitrary=query")).toThrow(/query parameters .* are not supported/i);
  });
});

describe("Cloudinary Integration & Validation Security", () => {
  const cloudinary = new CloudinaryService();

  it("should verify file magic bytes for valid JPEG, PNG, WEBP, and PDF", () => {
    // Valid JPEG magic bytes (FF D8 FF E0)
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
    expect(inspectFileMagicBytes(jpegBuffer)).toEqual({ format: "jpg", mimeType: "image/jpeg" });

    // Valid PNG magic bytes (89 50 4E 47 0D 0A 1A 0A)
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(inspectFileMagicBytes(pngBuffer)).toEqual({ format: "png", mimeType: "image/png" });

    // Valid WEBP magic bytes (RIFF .... WEBP)
    const webpBuffer = Buffer.from([
      0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ]);
    expect(inspectFileMagicBytes(webpBuffer)).toEqual({ format: "webp", mimeType: "image/webp" });

    // Valid PDF magic bytes (%PDF)
    const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
    expect(inspectFileMagicBytes(pdfBuffer)).toEqual({ format: "pdf", mimeType: "application/pdf" });

    // Corrupt or unrecognized executable (MZ)
    const exeBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00]);
    expect(inspectFileMagicBytes(exeBuffer)).toBeNull();

    // Short buffer (< 4 bytes)
    expect(inspectFileMagicBytes(Buffer.from([0x01, 0x02]))).toBeNull();
  });

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

  it("should validate and reject SSRF remote URLs and enforce HTTPS", async () => {
    await expect(cloudinary.validateRemoteUrl("http://example.com/image.png")).rejects.toThrow(
      /Remote upload URLs must use HTTPS/i
    );
    await expect(cloudinary.validateRemoteUrl("https://localhost/image.png")).rejects.toThrow(
      /internal, loopback, or metadata services are forbidden/i
    );
    await expect(cloudinary.validateRemoteUrl("https://127.0.0.1/secret")).rejects.toThrow(
      /internal, loopback, or metadata services are forbidden/i
    );
    await expect(cloudinary.validateRemoteUrl("https://169.254.169.254/latest/meta-data")).rejects.toThrow(
      /internal, loopback, or metadata services are forbidden/i
    );
    await expect(cloudinary.validateRemoteUrl("https://metadata.google.internal/computeMetadata")).rejects.toThrow(
      /internal, loopback, or metadata services are forbidden/i
    );
    await expect(cloudinary.validateRemoteUrl("https://192.168.1.50/private.png")).rejects.toThrow(
      /internal, loopback, or metadata services are forbidden/i
    );
    await expect(cloudinary.validateRemoteUrl("https://10.0.0.1/internal.jpg")).rejects.toThrow(
      /internal, loopback, or metadata services are forbidden/i
    );
    await expect(cloudinary.validateRemoteUrl("https://api.service.internal/upload.jpg")).rejects.toThrow(
      /internal, loopback, or metadata services are forbidden/i
    );
  });

  it("should perform async DNS resolution and block domains resolving to private/metadata IPs", async () => {
    const dnsLookupSpy = vi.spyOn(dns, "lookup");

    // Domain resolving to loopback 127.0.0.1
    dnsLookupSpy.mockResolvedValueOnce([{ address: "127.0.0.1", family: 4 }] as any);
    await expect(cloudinary.validateRemoteUrl("https://public-looking-domain.com/avatar.jpg")).rejects.toThrow(
      /resolving to internal or private addresses/i
    );

    // Domain resolving to cloud metadata IP 169.254.169.254
    dnsLookupSpy.mockResolvedValueOnce([{ address: "169.254.169.254", family: 4 }] as any);
    await expect(cloudinary.validateRemoteUrl("https://cloud-spoof.com/meta")).rejects.toThrow(
      /resolving to internal or private addresses/i
    );

    // Domain resolving to IPv6 loopback ::1
    dnsLookupSpy.mockResolvedValueOnce([{ address: "::1", family: 6 }] as any);
    await expect(cloudinary.validateRemoteUrl("https://ipv6-loopback.com/photo.png")).rejects.toThrow(
      /resolving to internal or private addresses/i
    );

    // Domain resolving to valid public IP
    dnsLookupSpy.mockResolvedValueOnce([{ address: "93.184.216.34", family: 4 }] as any);
    await expect(cloudinary.validateRemoteUrl("https://safe-cdn.com/photo.png")).resolves.toBeUndefined();

    dnsLookupSpy.mockRestore();
  });

  it("should verify assets with provider and prevent cross-user avatar claims including substring collisions", async () => {
    const validAvatar = await cloudinary.verifyAssetWithProvider(
      "chovia/avatars/user_123_profile",
      "avatars",
      "user_123"
    );
    expect(validAvatar.publicId).toBe("chovia/avatars/user_123_profile");
    expect(validAvatar.format).toBe("webp");

    // Subdirectory format: chovia/avatars/user_123/profile
    const validNestedAvatar = await cloudinary.verifyAssetWithProvider(
      "chovia/avatars/user_123/profile",
      "avatars",
      "user_123"
    );
    expect(validNestedAvatar.publicId).toBe("chovia/avatars/user_123/profile");

    // Cross-user avatar claim must be rejected
    await expect(
      cloudinary.verifyAssetWithProvider(
        "chovia/avatars/user_victim_profile",
        "avatars",
        "user_attacker"
      )
    ).rejects.toThrow(/Unauthorized asset claim/i);

    // Substring collision prevention: "user_1" vs "user_100"
    await expect(
      cloudinary.verifyAssetWithProvider(
        "chovia/avatars/user_100_profile",
        "avatars",
        "user_1"
      )
    ).rejects.toThrow(/Unauthorized asset claim/i);

    // Wrong folder prefix must be rejected
    await expect(
      cloudinary.verifyAssetWithProvider(
        "chovia/menu/dish_123",
        "avatars",
        "user_123"
      )
    ).rejects.toThrow(/does not belong to expected folder/i);
  });

  it("should enforce authenticated private delivery and ownership for KYC documents", async () => {
    const docSig = cloudinary.generateUploadSignature("documents", "rider_1/nin_card");
    expect(docSig.folder).toBe("chovia/documents");
    expect(docSig.deliveryType).toBe("authenticated");
    expect(docSig.publicId).toBe("rider_1/nin_card");

    const verifiedDoc = await cloudinary.verifyAssetWithProvider(
      "chovia/documents/rider_1/nin_card",
      "documents",
      "rider_1"
    );
    expect(verifiedDoc.deliveryType).toBe("authenticated");
    expect(verifiedDoc.secureUrl).not.toContain("/upload/");
    expect(verifiedDoc.secureUrl).toContain("type=authenticated");

    // Cross-rider KYC document claim must be rejected
    await expect(
      cloudinary.verifyAssetWithProvider(
        "chovia/documents/rider_1/nin_card",
        "documents",
        "rider_2"
      )
    ).rejects.toThrow(/Unauthorized asset claim/i);

    // Substring collision on KYC documents must be rejected
    await expect(
      cloudinary.verifyAssetWithProvider(
        "chovia/documents/rider_10/nin_card",
        "documents",
        "rider_1"
      )
    ).rejects.toThrow(/Unauthorized asset claim/i);
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

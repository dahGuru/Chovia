import "dotenv/config";
import { z } from "zod";

const DEFAULT_DEV_JWT_ACCESS = "chovia_dev_jwt_access_secret_must_be_overridden_in_prod_32c";
const DEFAULT_DEV_JWT_REFRESH = "chovia_dev_jwt_refresh_secret_must_be_overridden_in_prod_32c";
const DEFAULT_DEV_OTP_HMAC = "chovia_dev_otp_hmac_secret_must_be_overridden_in_prod_32c";

export const environmentSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
    HOST: z.string().min(1).default("0.0.0.0"),
    PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
    FRONTEND_URL: z.string().url().default("http://localhost:3000"),
    DATABASE_URL: z
      .string()
      .min(1)
      .default("postgresql://postgres:postgres@localhost:5432/chovia?schema=public"),
    DIRECT_URL: z.string().optional(),
    REDIS_URL: z.string().min(1).default("redis://localhost:6379"),

    // JWT Security
    JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
    JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
    JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
    JWT_REFRESH_EXPIRES_IN_DAYS: z.coerce.number().int().min(1).max(90).default(30),

    // OTP Security
    OTP_HMAC_SECRET: z.string().min(32, "OTP_HMAC_SECRET must be at least 32 characters"),
    OTP_EXPIRES_IN_MINUTES: z.coerce.number().int().min(1).max(60).default(15),

    // CORS & Mocking
    CORS_ORIGIN: z.string().default("http://localhost:3000,http://localhost:3001,http://localhost:3002"),
    MOCK_INTEGRATIONS: z
      .preprocess((val) => {
        if (typeof val === "boolean") return val;
        if (typeof val === "string") return val.toLowerCase() === "true";
        return false;
      }, z.boolean())
      .default(false),

    // Paystack
    PAYSTACK_SECRET_KEY: z.string().default(""),
    PAYSTACK_PUBLIC_KEY: z.string().default(""),
    PAYSTACK_WEBHOOK_SECRET: z.string().default(""),

    // Cloudinary
    CLOUDINARY_CLOUD_NAME: z.string().default(""),
    CLOUDINARY_API_KEY: z.string().default(""),
    CLOUDINARY_API_SECRET: z.string().default(""),

    // Resend Email
    RESEND_API_KEY: z.string().default(""),
    EMAIL_FROM: z.string().default("CHOVIA <no-reply@chovia.app>"),

    // Sentry Monitoring
    SENTRY_DSN: z.string().default(""),
    SENTRY_ENVIRONMENT: z.string().default("development"),

    // Google Maps Platform
    GOOGLE_MAPS_API_KEY: z.string().default(""),
    GOOGLE_MAPS_USE_ROUTES_API: z
      .preprocess((val) => {
        if (typeof val === "boolean") return val;
        if (typeof val === "string") return val.toLowerCase() === "true";
        return true;
      }, z.boolean())
      .default(true),
  })
  .superRefine((data, ctx) => {
    const isProd = data.NODE_ENV === "production";
    const isStaging = data.NODE_ENV === "staging";

    if (isProd) {
      if (data.MOCK_INTEGRATIONS) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["MOCK_INTEGRATIONS"],
          message: "MOCK_INTEGRATIONS is strictly forbidden in production.",
        });
      }

      if (
        data.DATABASE_URL.includes("localhost") ||
        data.DATABASE_URL.includes("127.0.0.1") ||
        data.DATABASE_URL === "postgresql://postgres:postgres@localhost:5432/chovia?schema=public"
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["DATABASE_URL"],
          message: "Production DATABASE_URL must not point to localhost.",
        });
      }

      if (
        data.REDIS_URL.includes("localhost") ||
        data.REDIS_URL.includes("127.0.0.1") ||
        data.REDIS_URL === "redis://localhost:6379"
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["REDIS_URL"],
          message: "Production REDIS_URL must not point to localhost.",
        });
      }

      if (data.JWT_ACCESS_SECRET === DEFAULT_DEV_JWT_ACCESS || data.JWT_ACCESS_SECRET.includes("dev")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["JWT_ACCESS_SECRET"],
          message: "Insecure or default JWT_ACCESS_SECRET cannot be used in production.",
        });
      }

      if (data.JWT_REFRESH_SECRET === DEFAULT_DEV_JWT_REFRESH || data.JWT_REFRESH_SECRET.includes("dev")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["JWT_REFRESH_SECRET"],
          message: "Insecure or default JWT_REFRESH_SECRET cannot be used in production.",
        });
      }

      if (data.JWT_ACCESS_SECRET === data.JWT_REFRESH_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["JWT_REFRESH_SECRET"],
          message: "JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be distinct keys.",
        });
      }

      if (data.OTP_HMAC_SECRET === DEFAULT_DEV_OTP_HMAC || data.OTP_HMAC_SECRET.includes("dev")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["OTP_HMAC_SECRET"],
          message: "Insecure or default OTP_HMAC_SECRET cannot be used in production.",
        });
      }

      if (data.CORS_ORIGIN === "*" || data.CORS_ORIGIN.includes("*")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["CORS_ORIGIN"],
          message: "Wildcard CORS origin is forbidden in production with credentials.",
        });
      }

      // Paystack Live Key validation: Production must use a live key and reject any test or mock key
      if (!data.PAYSTACK_SECRET_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["PAYSTACK_SECRET_KEY"],
          message: "PAYSTACK_SECRET_KEY is required in production.",
        });
      } else if (!/^sk_live_[a-zA-Z0-9]+$/.test(data.PAYSTACK_SECRET_KEY)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["PAYSTACK_SECRET_KEY"],
          message: "Production requires a valid Paystack live secret key (sk_live_...). Test or mock keys are rejected.",
        });
      }

      if (!data.PAYSTACK_WEBHOOK_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["PAYSTACK_WEBHOOK_SECRET"],
          message: "PAYSTACK_WEBHOOK_SECRET is required in production.",
        });
      }

      if (!data.CLOUDINARY_CLOUD_NAME || !data.CLOUDINARY_API_KEY || !data.CLOUDINARY_API_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["CLOUDINARY_CLOUD_NAME"],
          message: "Cloudinary credentials (CLOUD_NAME, API_KEY, API_SECRET) are required in production.",
        });
      }

      if (!data.RESEND_API_KEY || !data.RESEND_API_KEY.startsWith("re_")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["RESEND_API_KEY"],
          message: "A valid RESEND_API_KEY starting with 're_' is required in production.",
        });
      }

      if (!data.GOOGLE_MAPS_API_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["GOOGLE_MAPS_API_KEY"],
          message: "GOOGLE_MAPS_API_KEY is required in production.",
        });
      }

      if (!data.SENTRY_DSN || !data.SENTRY_DSN.startsWith("http")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["SENTRY_DSN"],
          message: "A valid SENTRY_DSN URL is mandatory in production.",
        });
      }
    } else if (isStaging) {
      if (data.MOCK_INTEGRATIONS) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["MOCK_INTEGRATIONS"],
          message: "MOCK_INTEGRATIONS cannot be silently enabled in staging.",
        });
      }

      if (data.JWT_ACCESS_SECRET === data.JWT_REFRESH_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["JWT_REFRESH_SECRET"],
          message: "JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be distinct keys in staging.",
        });
      }
    } else {
      // In development or test, if secrets are not explicitly provided, supply safe development defaults
      if (!data.JWT_ACCESS_SECRET) {
        data.JWT_ACCESS_SECRET = DEFAULT_DEV_JWT_ACCESS;
      }
      if (!data.JWT_REFRESH_SECRET) {
        data.JWT_REFRESH_SECRET = DEFAULT_DEV_JWT_REFRESH;
      }
      if (!data.OTP_HMAC_SECRET) {
        data.OTP_HMAC_SECRET = DEFAULT_DEV_OTP_HMAC;
      }
    }
  });

export type Environment = z.infer<typeof environmentSchema>;

// Provide dev fallbacks in process.env before parsing if dev/test
if (process.env["NODE_ENV"] !== "production" && process.env["NODE_ENV"] !== "staging") {
  if (!process.env["JWT_ACCESS_SECRET"]) {
    process.env["JWT_ACCESS_SECRET"] = DEFAULT_DEV_JWT_ACCESS;
  }
  if (!process.env["JWT_REFRESH_SECRET"]) {
    process.env["JWT_REFRESH_SECRET"] = DEFAULT_DEV_JWT_REFRESH;
  }
  if (!process.env["OTP_HMAC_SECRET"]) {
    process.env["OTP_HMAC_SECRET"] = DEFAULT_DEV_OTP_HMAC;
  }
}

export const env = environmentSchema.parse(process.env);

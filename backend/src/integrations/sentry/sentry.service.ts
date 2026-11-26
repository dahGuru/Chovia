import * as Sentry from "@sentry/node";
import { env } from "../../config/env.js";

export const SENSITIVE_KEYS = new Set([
  "password",
  "passwordhash",
  "passwordsalt",
  "token",
  "accesstoken",
  "refreshtoken",
  "resettoken",
  "bearertoken",
  "jwt",
  "otp",
  "signedtoken",
  "authorization",
  "secret",
  "secretkey",
  "webhooksecret",
  "apikey",
  "cookie",
  "cvv",
  "cvc",
  "cardnumber",
  "pan",
  "pin",
  "accountnumber",
  "bankaccountnumber",
  "governmentidnumber",
  "nationalidnumber",
  "idnumber",
  "bvn",
  "nin",
  "kycencryptionkey",
]);

/**
 * Sanitizes primitive strings by detecting and masking embedded secrets,
 * bearer tokens, JWT tokens, database URLs, Paystack keys, and secret parameters.
 */
export function sanitizeString(val: string): string {
  if (!val || typeof val !== "string") return val;

  let sanitized = val;

  // 1. Bearer tokens: Bearer <token>
  sanitized = sanitized.replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, "Bearer [REDACTED]");

  // 2. JWTs: eyJ...
  sanitized = sanitized.replace(
    /eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g,
    "[REDACTED_JWT]"
  );

  // 3. Credentials embedded in connection URLs (e.g. postgres://user:password@host)
  sanitized = sanitized.replace(/([a-zA-Z]+:\/\/)([^:]+):([^@]+)@/g, "$1$2:[REDACTED]@");

  // 4. Paystack keys: sk_live_..., sk_test_...
  sanitized = sanitized.replace(/sk_(live|test)_[a-zA-Z0-9]+/g, "sk_$1_[REDACTED]");

  // 5. Resend keys: re_...
  sanitized = sanitized.replace(/re_[a-zA-Z0-9]{20,}/g, "re_[REDACTED]");

  // 6. Query parameters with secrets: (password|token|secret|key|otp|auth)=value
  sanitized = sanitized.replace(
    /([?&](?:password|token|secret|key|otp|auth|authorization)=)([^&]+)/gi,
    "$1[REDACTED]"
  );

  return sanitized;
}

/**
 * Pure, non-mutating deep sanitizer that scrubs sensitive credentials,
 * tokens, passwords, OTPs, and financial data from event payloads.
 * Employs bounded recursion (max depth 10) and a WeakSet visited tracker to prevent circular reference stack overflows.
 */
export function scrubData(data: unknown, depth = 0, visited = new WeakSet<object>()): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === "string") {
    return sanitizeString(data);
  }

  if (typeof data !== "object") {
    return data;
  }

  if (depth >= 10) {
    return "[MAX_DEPTH_EXCEEDED]";
  }

  if (visited.has(data)) {
    return "[CIRCULAR]";
  }
  visited.add(data);

  if (Array.isArray(data)) {
    return data.map((item) => scrubData(item, depth + 1, visited));
  }

  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z]/g, "");
    const isSensitive =
      SENSITIVE_KEYS.has(normalizedKey) ||
      Array.from(SENSITIVE_KEYS).some((s) => normalizedKey.includes(s));

    if (isSensitive) {
      clean[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      clean[key] = scrubData(value, depth + 1, visited);
    } else if (typeof value === "string") {
      clean[key] = sanitizeString(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

export class SentryService {
  private isInitialized = false;

  init(): void {
    if (this.isInitialized) {
      return;
    }

    if (!env.SENTRY_DSN) {
      if (env.NODE_ENV === "production") {
        throw new Error("Fatal: SENTRY_DSN is required in production for error monitoring.");
      }
      return;
    }

    try {
      Sentry.init({
        dsn: env.SENTRY_DSN,
        environment: env.SENTRY_ENVIRONMENT || env.NODE_ENV,
        tracesSampleRate: env.NODE_ENV === "production" ? 0.2 : 1.0,
        beforeSend(event) {
          // 1. Scrub event-level string metadata
          if (event.message) {
            event.message = sanitizeString(event.message);
          }
          if (event.transaction) {
            event.transaction = sanitizeString(event.transaction);
          }
          if (event.tags) {
            event.tags = scrubData(event.tags) as Record<string, string | number | boolean>;
          }

          // 2. Scrub HTTP request context
          if (event.request) {
            if (event.request.url) {
              event.request.url = sanitizeString(event.request.url);
            }
            if (event.request.headers) {
              event.request.headers = scrubData(event.request.headers) as Record<string, string>;
            }
            if (event.request.data) {
              event.request.data = scrubData(event.request.data);
            }
            if (event.request.query_string) {
              event.request.query_string = sanitizeString(
                typeof event.request.query_string === "string"
                  ? event.request.query_string
                  : JSON.stringify(event.request.query_string)
              );
            }
            if (event.request.cookies) {
              event.request.cookies = scrubData(event.request.cookies) as Record<string, string>;
            }
          }

          // 3. Scrub user context
          if (event.user) {
            event.user = scrubData(event.user) as Sentry.User;
          }

          // 4. Scrub extra and context metadata
          if (event.extra) {
            event.extra = scrubData(event.extra) as Record<string, unknown>;
          }
          if (event.contexts) {
            event.contexts = scrubData(event.contexts) as Record<string, Record<string, unknown>>;
          }

          // 5. Scrub exception values and messages
          if (event.exception?.values) {
            for (const v of event.exception.values) {
              if (v.value) {
                v.value = sanitizeString(v.value);
              }
            }
          }

          // 6. Scrub breadcrumbs
          if (event.breadcrumbs) {
            for (const b of event.breadcrumbs) {
              if (b.message) {
                b.message = sanitizeString(b.message);
              }
              if (b.data) {
                b.data = scrubData(b.data) as Record<string, unknown>;
              }
            }
          }

          return event;
        },
      });

      this.isInitialized = true;
    } catch (error) {
      if (env.NODE_ENV === "production") {
        throw new Error(
          `Fatal: Failed to initialize Sentry in production: ${error instanceof Error ? error.message : "Unknown error"}`,
          { cause: error }
        );
      }
    }
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  captureException(error: unknown, context?: Record<string, unknown>): void {
    if (!this.isInitialized) {
      return;
    }

    try {
      // Do not mutate original Error object; scrubbing is handled non-mutatively in beforeSend
      Sentry.withScope((scope) => {
        if (context) {
          scope.setExtras(scrubData(context) as Record<string, unknown>);
        }
        Sentry.captureException(error);
      });
    } catch {
      // Fail silently to prevent exception recursion
    }
  }

  captureJobError(
    error: unknown,
    jobContext: {
      queueName: string;
      jobName: string;
      jobId?: string | undefined;
      attemptsMade?: number | undefined;
    }
  ): void {
    this.captureException(error, {
      type: "BULLMQ_JOB_FAILURE",
      ...jobContext,
    });
  }
}

export const sentryService = new SentryService();

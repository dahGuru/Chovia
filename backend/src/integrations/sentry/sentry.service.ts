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
  "bvn",
  "nin",
]);

/**
 * Pure, non-mutating deep sanitizer that scrubs sensitive credentials,
 * tokens, passwords, OTPs, and financial data from event payloads.
 */
export function scrubData(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data !== "object") {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => scrubData(item));
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
      clean[key] = scrubData(value);
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
          // 1. Scrub HTTP request context
          if (event.request) {
            if (event.request.headers) {
              event.request.headers = scrubData(event.request.headers) as Record<string, string>;
            }
            if (event.request.data) {
              event.request.data = scrubData(event.request.data);
            }
            if (event.request.query_string) {
              event.request.query_string = scrubData(event.request.query_string) as string;
            }
            if (event.request.cookies) {
              event.request.cookies = scrubData(event.request.cookies) as Record<string, string>;
            }
          }

          // 2. Scrub user context
          if (event.user) {
            event.user = scrubData(event.user) as Sentry.User;
          }

          // 3. Scrub extra and context metadata
          if (event.extra) {
            event.extra = scrubData(event.extra) as Record<string, unknown>;
          }
          if (event.contexts) {
            event.contexts = scrubData(event.contexts) as Record<string, Record<string, unknown>>;
          }

          // 4. Scrub breadcrumbs
          if (event.breadcrumbs) {
            event.breadcrumbs = event.breadcrumbs.map((b) => {
              if (b.data) {
                return {
                  ...b,
                  data: scrubData(b.data) as Record<string, unknown>,
                };
              }
              return b;
            });
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

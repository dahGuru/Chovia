# CHOVIA — Backend Environment & Configuration

> **Document:** Environment Variables Specification, Configuration Validation, and Secret Management  
> **Status:** Implemented MVP (Validated against Zod schema with strict staging/production verification rules)  
> **File Reference:** [backend/src/config/env.ts](file:///C:/Users/HP/Videos/WEB DEV 1.0/Food Delivery/Chovia/backend/src/config/env.ts)  
> **Template File:** [backend/.env.example](file:///C:/Users/HP/Videos/WEB DEV 1.0/Food Delivery/Chovia/backend/.env.example)  

---

## 1. Overview and Configuration Strategy

CHOVIA enforces runtime configuration validation using **Zod 4**. When the Fastify backend initializes, [src/config/env.ts](file:///C:/Users/HP/Videos/WEB DEV 1.0/Food Delivery/Chovia/backend/src/config/env.ts) parses and validates all environment variables against an explicit schema before any route or database connection is established. If any mandatory configuration is missing or malformed, the application immediately aborts startup with a descriptive error message.

### Environment Modes: Development, Staging, and Production

| Rule | Development (`development`) | Staging (`staging`) | Production (`production`) |
|---|---|---|---|
| `MOCK_INTEGRATIONS` | Allowed (`true` or `false`) | **Strictly Forbidden (`false`)** | **Strictly Forbidden (`false`)** |
| `DATABASE_URL` | Localhost permitted | **Must NOT point to localhost** | **Must NOT point to localhost** |
| `REDIS_URL` | Localhost permitted | **Must NOT point to localhost** | **Must NOT point to localhost** |
| `PAYSTACK_SECRET_KEY` | `sk_test_*` allowed | `sk_test_*` or `sk_live_*` allowed | **Must be live (`sk_live_*`)** |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Dev defaults allowed (32+ chars) | Required, must be distinct (32+ chars) | Required, must be distinct (32+ chars) |
| `OTP_HMAC_SECRET` | Dev default allowed (32+ chars) | Required (32+ chars) | Required (32+ chars) |
| Cloudinary (`CLOUDINARY_*`) | Optional in mock mode | **Required** | **Required** |
| Resend (`RESEND_API_KEY`) | Optional in mock mode | **Required** | **Required** |
| Google Maps (`GOOGLE_MAPS_API_KEY`) | Optional in mock mode | **Required** | **Required** |
| Sentry (`SENTRY_DSN`) | Optional in dev | **Required** | **Required** |

---

## 2. Environment Variables Catalogue

| Variable | Type | Default | Required in Staging / Prod | Description |
|---|---|---|---|---|
| `NODE_ENV` | Enum | `"development"` | Yes | Environment mode: `"development"`, `"staging"`, `"production"`, or `"test"` |
| `PORT` | Integer | `4000` | No | HTTP port for Fastify server |
| `HOST` | String | `"0.0.0.0"` | No | Host interface to bind HTTP listener |
| `FRONTEND_URL` | String | `"http://localhost:3000"` | Yes | Authoritative frontend client origin |
| `DATABASE_URL` | String | (Local dev URL) | **Yes** | Authoritative PostgreSQL connection string (pooled Neon + PostGIS) |
| `DIRECT_URL` | String | `undefined` | No | Direct database connection string for Prisma CLI schema migrations |
| `REDIS_URL` | String | `"redis://localhost:6379"` | **Yes** | Redis connection URI (`redis://` or `rediss://`; port 1-65535; db 0-15) |
| `JWT_ACCESS_SECRET` | String | (Dev secret) | **Yes** | Cryptographic secret for signing HMAC-SHA256 JWT access tokens (min 32 chars) |
| `JWT_REFRESH_SECRET` | String | (Dev secret) | **Yes** | Cryptographic secret for refresh tokens (min 32 chars, distinct from access) |
| `JWT_ACCESS_EXPIRES_IN` | String | `"15m"` | No | JWT access token lifespan (e.g. `"15m"`, `"1h"`) |
| `JWT_REFRESH_EXPIRES_IN_DAYS` | Integer | `30` | No | Refresh token lifespan in days |
| `OTP_HMAC_SECRET` | String | (Dev secret) | **Yes** | HMAC-SHA256 key for OTP generation and verification (min 32 chars) |
| `OTP_EXPIRES_IN_MINUTES` | Integer | `15` | No | Lifespan of OTP codes in minutes |
| `PAYSTACK_SECRET_KEY` | String | `""` | **Yes** | Paystack secret key (`sk_live_*` in production; `sk_test_*` in staging/dev) |
| `PAYSTACK_PUBLIC_KEY` | String | `""` | **Yes** | Paystack public key for frontend payment checkout |
| `PAYSTACK_WEBHOOK_SECRET` | String | `""` | **Yes** | Secret used to verify HMAC-SHA512 webhook signatures from Paystack |
| `CLOUDINARY_CLOUD_NAME` | String | `""` | **Yes** | Cloudinary cloud identifier for signed media uploads |
| `CLOUDINARY_API_KEY` | String | `""` | **Yes** | Cloudinary API Key |
| `CLOUDINARY_API_SECRET` | String | `""` | **Yes** | Cloudinary API Secret for upload signature computation |
| `RESEND_API_KEY` | String | `""` | **Yes** | Resend API key for transactional email delivery |
| `EMAIL_FROM` | String | `"CHOVIA <no-reply@chovia.app>"` | No | Default sender address for transactional emails |
| `GOOGLE_MAPS_API_KEY` | String | `""` | **Yes** | Google Maps Platform API key (Routes API & Geocoding) |
| `GOOGLE_MAPS_USE_ROUTES_API` | Boolean | `true` | No | When `true`, queries Routes API for motorcycle routes; Haversine fallback |
| `SENTRY_DSN` | String | `""` | **Yes** | Sentry DSN endpoint for error reporting and APM telemetry |
| `SENTRY_ENVIRONMENT` | String | `"development"` | No | Sentry deployment environment tag |
| `EXPO_ACCESS_TOKEN` | String | `""` | No | Expo push API access token for authenticated push notification requests |
| `MOCK_INTEGRATIONS` | Boolean | `false` | Forbidden | Operates integrations in offline mock mode (strictly forbidden in staging/prod) |
| `CORS_ORIGIN` | String | (Local dev origins) | Yes | Allowed CORS origin string or comma-separated list |

---

## 3. Secret Management and Security Guidelines

1. **Never Commit Secrets:**  
   `.env` and `.env.*` files are explicitly excluded in the root `.gitignore`. Never commit actual API keys, database credentials, or JWT signing secrets to version control.
2. **Never Print Secrets in Logs:**  
   The application logs configuration status during startup without dumping environment variable values. Error handlers and Sentry instrumentation scrub sensitive credentials and tokens deeply.
3. **Staging and Production Verification:**  
   In staging and production environments, all secrets must be injected securely via platform secret managers or container orchestration secrets. Staging validates real third-party integrations with test keys before production deployment.
4. **Local Development Setup:**  
   To set up a local development environment, copy the template file:
   ```bash
   cp backend/.env.example backend/.env
   ```
   Modify `DATABASE_URL` and `REDIS_URL` to match your local services if needed.

# CHOVIA — Backend Environment & Configuration

> **Document:** Environment Variables Specification, Configuration Validation, and Secret Management  
> **Status:** Production-Ready MVP Implementation  
> **File Reference:** [backend/src/config/env.ts](file:///C:/Users/HP/Videos/WEB DEV 1.0/Food Delivery/Chovia/backend/src/config/env.ts)  
> **Template File:** [backend/.env.example](file:///C:/Users/HP/Videos/WEB DEV 1.0/Food Delivery/Chovia/backend/.env.example)  

---

## 1. Overview and Configuration Strategy

CHOVIA enforces runtime configuration validation using **Zod 4**. When the Fastify backend initializes, [src/config/env.ts](file:///C:/Users/HP/Videos/WEB DEV 1.0/Food Delivery/Chovia/backend/src/config/env.ts) parses and validates all environment variables against an explicit schema before any route or database connection is established. If any mandatory configuration is missing or malformed, the application immediately aborts startup with a descriptive error message.

### Safe Development Defaults
To ensure developers can run the backend immediately without complex external dependencies:
- Sensitive secrets have safe development defaults when `NODE_ENV !== "production"`.
- `MOCK_INTEGRATIONS=true` enables self-contained, offline fallbacks for Paystack, Google Maps, Cloudflare R2/S3, and Email services.
- Database URL defaults to a local PostgreSQL instance (`postgresql://postgres:postgres@localhost:5432/chovia`).
- Redis defaults to `redis://localhost:6379` with automatic fallback to an internal in-memory cache if the Redis daemon is offline.

---

## 2. Environment Variables Catalogue

| Variable | Type | Default | Required in Production | Description |
|---|---|---|---|---|
| `NODE_ENV` | Enum | `"development"` | Yes | Application environment: `"development"`, `"production"`, or `"test"` |
| `PORT` | Integer | `4000` | No | HTTP port for Fastify server |
| `HOST` | String | `"0.0.0.0"` | No | Host interface to bind HTTP listener |
| `DATABASE_URL` | String | `"postgresql://postgres:postgres@localhost:5432/chovia"` | **Yes** | Authoritative PostgreSQL connection string (pooled connection) |
| `DIRECT_URL` | String | `undefined` | No | Direct database connection string for Prisma CLI schema migrations |
| `REDIS_URL` | String | `"redis://localhost:6379"` | **Yes** | Redis connection URI for caching and BullMQ queue infrastructure |
| `JWT_ACCESS_SECRET` | String | (Dev secret) | **Yes** | Cryptographic secret for signing HMAC-SHA256 JWT access tokens |
| `JWT_REFRESH_SECRET` | String | (Dev secret) | **Yes** | Cryptographic secret for signing and verifying refresh tokens |
| `JWT_ACCESS_EXPIRES_IN` | String | `"15m"` | No | JWT access token lifespan (e.g. `"15m"`, `"1h"`) |
| `JWT_REFRESH_EXPIRES_IN` | String | `"30d"` | No | Refresh token lifespan (e.g. `"30d"`, `"7d"`) |
| `PAYSTACK_SECRET_KEY` | String | `""` | **Yes** | Paystack secret key (`sk_live_...` or `sk_test_...`) |
| `PAYSTACK_PUBLIC_KEY` | String | `""` | **Yes** | Paystack public key for frontend payment checkout |
| `PAYSTACK_WEBHOOK_SECRET` | String | `""` | **Yes** | Secret used to verify HMAC-SHA512 webhook signatures from Paystack |
| `GOOGLE_MAPS_API_KEY` | String | `""` | **Yes** | Google Maps API key for Geocoding and Distance Matrix calculations |
| `STORAGE_ENDPOINT` | String | `""` | No | S3 / Cloudflare R2 compatible S3 API endpoint URL |
| `STORAGE_ACCESS_KEY` | String | `""` | No | Cloudflare R2 / AWS S3 access key ID |
| `STORAGE_SECRET_KEY` | String | `""` | No | Cloudflare R2 / AWS S3 secret access key |
| `STORAGE_BUCKET` | String | `"chovia-assets"` | No | Target S3 bucket name for uploads |
| `STORAGE_PUBLIC_URL` | String | `"https://storage.chovia.app"` | No | Public CDN URL for serving uploaded assets |
| `EMAIL_FROM` | String | `"CHOVIA <no-reply@chovia.app>"` | No | Default sender address for transactional emails |
| `SMTP_HOST` | String | `""` | No | SMTP server hostname for transactional email delivery |
| `SMTP_PORT` | Integer | `587` | No | SMTP port (e.g. 587 for TLS, 465 for SSL) |
| `SMTP_USER` | String | `""` | No | SMTP authentication username |
| `SMTP_PASS` | String | `""` | No | SMTP authentication password |
| `MOCK_INTEGRATIONS` | Boolean | `true` (in dev) | No | When `true`, third-party services operate in offline mock mode |
| `CORS_ORIGIN` | String | `"*"` | No | Allowed CORS origin string or comma-separated list |

---

## 3. Secret Management and Security Guidelines

1. **Never Commit Secrets:**  
   `.env` and `.env.*` files are explicitly excluded in the root `.gitignore`. Never commit actual API keys, database credentials, or JWT signing secrets to version control.
2. **Never Print Secrets in Logs:**  
   The application logs configuration status during startup without dumping environment variable values. Error handlers strip sensitive fields from response bodies.
3. **Production Configuration:**  
   In production environments (e.g. Neon, AWS, Cloudflare, Fly.io, Railway), environment variables must be injected securely via platform secret managers or container environment injection.
4. **Local Development Setup:**  
   To set up a local development environment, copy the template file:
   ```bash
   cp backend/.env.example backend/.env
   ```
   Modify `DATABASE_URL` and `REDIS_URL` to match your local services if needed.

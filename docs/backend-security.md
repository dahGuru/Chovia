# CHOVIA — Backend Security Architecture

> **Document:** Authentication, Authorization, Token Lifecycle, and Security Controls  
> **Status:** Implemented MVP (Automated tests pass; requires staging verification)  
> **Plugins Reference:** [backend/src/plugins/jwt.ts](file:///C:/Users/HP/Videos/WEB DEV 1.0/Food Delivery/Chovia/backend/src/plugins/jwt.ts), [backend/src/plugins/auth-guard.ts](file:///C:/Users/HP/Videos/WEB DEV 1.0/Food Delivery/Chovia/backend/src/plugins/auth-guard.ts)  
> **Security Utils:** [backend/src/utils/password.ts](file:///C:/Users/HP/Videos/WEB DEV 1.0/Food Delivery/Chovia/backend/src/utils/password.ts), [backend/src/utils/crypto.ts](file:///C:/Users/HP/Videos/WEB DEV 1.0/Food Delivery/Chovia/backend/src/utils/crypto.ts)  

---

## 1. Authentication Architecture

CHOVIA's authentication architecture adheres strictly to `TECH-STACK.md` and `AGENTS.md`. Better Auth has been completely removed in favor of a robust, standard JWT + bcrypt implementation with database-backed refresh token sessions.

### Core Security Tenets

1. **Mandatory Passwords:** All user account categories (Customer, Rider, Restaurant Staff, Administrator) must set a password. Passwordless login is strictly prohibited.
2. **bcrypt Password Hashing:** Passwords are hashed using bcrypt with 12 salt rounds before persistence. Plaintext passwords never touch the database or log outputs.
3. **Short-Lived Access Tokens:** Fastify JWT access tokens expire after 15 minutes and contain minimal claims (`id`, `email`, `role`, `status`).
4. **Refresh Token Family Rotation:** Refresh tokens are tracked in PostgreSQL (`RefreshToken` model). Every refresh operation issues a new token pair and invalidates the previous refresh token.
5. **Reuse Detection (Anti-Breach):** If a previously used or revoked refresh token is presented, the system detects a token theft attempt and immediately revokes all refresh tokens in that family, forcing re-authentication.
6. **Email OTP Verification:** 6-digit cryptographic OTPs generated using HMAC-SHA256 with 15-minute expirations are used exclusively for account verification and password reset workflows.

---

## 2. Token Lifecycle & Family Rotation Flow

```text
Client                              Backend                             Database
  │                                    │                                    │
  │─── POST /auth/login ──────────────>│                                    │
  │    (email, password)               │─── Verify bcrypt hash ────────────>│
  │                                    │─── Create RefreshToken record ────>│
  │<── { accessToken, refreshToken } ──│                                    │
  │                                    │                                    │
  │─── POST /auth/refresh ────────────>│                                    │
  │    (refreshToken)                  │─── Look up token hash in DB ──────>│
  │                                    │    [If token already revoked]:     │
  │                                    │    Revoke entire token family!     │
  │                                    │    Return 401 Unauthorized         │
  │                                    │                                    │
  │                                    │    [If token valid]:               │
  │                                    │    Revoke old token                │
  │                                    │    Create new token in family ────>│
  │<── { accessToken, refreshToken } ──│                                    │
```

### PostgreSQL Refresh Token Session Model
In [database/prisma/schema.prisma](file:///C:/Users/HP/Videos/WEB DEV 1.0/Food Delivery/Chovia/database/prisma/schema.prisma):
- `tokenHash`: SHA-256 hash of the plain refresh token (plain token is never stored).
- `familyId`: UUID grouping all rotated tokens belonging to a single user session.
- `isRevoked`: Boolean flag marking invalidated tokens.
- `expiresAt`: Absolute expiration timestamp (30 days).

---

## 3. Authorization & Access Control (RBAC)

Authorization is enforced at the route boundary using Fastify preHandler hooks in [src/plugins/auth-guard.ts](file:///C:/Users/HP/Videos/WEB DEV 1.0/Food Delivery/Chovia/backend/src/plugins/auth-guard.ts):

### 3.1 Role-Based Access Control (`authorize`)
Enforces that the authenticated user possesses one of the designated system roles (`CUSTOMER`, `RESTAURANT_STAFF`, `RIDER`, `ADMIN`) and that their account status is `ACTIVE`:

```ts
fastify.get(
  "/admin/metrics",
  { preHandler: [fastify.authenticate, authorize(["ADMIN"])] },
  async (request, reply) => { ... }
);
```

### 3.2 Restaurant Staff Authorization (`requireRestaurantStaff`)
Restricts management actions (menu items, operating hours, categories, orders) to verified active staff members of the target restaurant or system administrators:

```ts
fastify.post(
  "/restaurants/:restaurantId/items",
  { preHandler: [fastify.authenticate, requireRestaurantStaff] },
  async (request, reply) => { ... }
);
```
The hook queries the `RestaurantStaffMembership` table to ensure that `request.user.id` has an `ACTIVE` membership with `restaurantId`.

---

## 4. Webhook Signature Verification

Third-party payment webhooks from Paystack are secured via HMAC-SHA512:

1. The raw HTTP request payload is captured before JSON parsing.
2. The `x-paystack-signature` HTTP header is extracted.
3. An HMAC-SHA512 digest of the raw payload is computed using `PAYSTACK_WEBHOOK_SECRET`.
4. The calculated digest is compared against the received header using `crypto.timingSafeEqual` to prevent timing attacks.
5. Invalid signatures are rejected immediately with `401 Unauthorized`.

---

## 5. Security Best Practices Implemented

- **No Mass Assignment:** Request DTOs strictly specify permitted fields. Raw input objects are never spread directly into Prisma operations.
- **Data Transfer Objects (DTOs):** All external endpoints filter database model output through explicit Zod response contracts. Password hashes, reset tokens, and OTP codes are strictly excluded.
- **Parameterized SQL:** All PostGIS raw SQL queries use tagged template literals (`prisma.$queryRaw`), eliminating SQL injection vulnerabilities.
- **Audit Logging:** Administrative operations (restaurant approval, rider suspension, config modifications) record structured audit entries with actor ID, entity ID, previous state, new state, IP address, and user agent.

---

## 6. Background Queue Security & Opaque Job IDs

Location: [backend/src/jobs/queues/index.ts](file:///C:/Users/HP/Videos/WEB DEV 1.0/Food Delivery/Chovia/backend/src/jobs/queues/index.ts)

To prevent sensitive Personally Identifiable Information (PII) or secrets from persisting in plaintext within Redis key spaces or monitoring dashboards:
- BullMQ `jobId` parameters are generated using `createOpaqueJobId(prefix, ...inputs)`.
- **Length-Prefixed Canonical Encoding:** Each input is serialized as `${byteLength}:${value}` before hashing. This mathematically eliminates delimiter collision attacks (e.g. `["a:b", "c"]` colliding with `["a", "b:c"]`).
- **Deterministic Deduplication:** Wall-clock timestamps (`Date.now()`) have been eliminated from job ID generation, allowing BullMQ to stably deduplicate identical idempotent jobs across server and worker restarts.
- The inputs (email addresses, OTP codes, invitation tokens) are hashed using SHA-256 and truncated to 24 hexadecimal characters.
- Job IDs strictly follow the pattern `<prefix>_<sha256_digest>` (e.g. `email_verify_a1b2c3d4e5f6...`), ensuring zero leakage of plain emails or secrets in Redis keys.

---

## 7. Media Upload Security, SSRF Prevention & Magic Byte Inspection

Location: [backend/src/integrations/cloudinary/cloudinary.service.ts](file:///C:/Users/HP/Videos/WEB DEV 1.0/Food Delivery/Chovia/backend/src/integrations/cloudinary/cloudinary.service.ts)

To mitigate malicious file uploads, executable masquerading, Server-Side Request Forgery (SSRF), and unconstrained resource consumption:
1. **Async DNS Resolution & SSRF Mitigation (`validateRemoteUrl`):** Enforces HTTPS and performs asynchronous DNS lookups (`dns.promises.lookup` with `{ all: true }`) resolving all IPv4 and IPv6 addresses. Blocks domains resolving to loopback (`127.0.0.0/8`, `::1`), private (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), link-local/cloud metadata (`169.254.0.0/16`, `fe80::/10`), carrier-grade NAT (`100.64.0.0/10`), unique local (`fc00::/7`), and documentation/test net ranges.
2. **Exact Segment-Based Asset Ownership:** Enforces exact path segment matching for user avatars (`chovia/avatars/{userId}/...` or `chovia/avatars/{userId}_...`), preventing substring collision vulnerabilities (e.g. `user_1` claiming `user_100` assets).
3. **Direct Signed Uploads:** The backend signs upload parameters using HMAC-SHA1 with folder restrictions, allowed formats, and byte size caps. Clients upload directly to Cloudinary using these credentials.
4. **Magic Byte Verification (`inspectFileMagicBytes`):** Before storing or attaching media assets, file buffers are inspected for authoritative magic numbers:
   - JPEG: `FF D8 FF`
   - PNG: `89 50 4E 47 0D 0A 1A 0A`
   - WEBP: `52 49 46 46 ... 57 45 42 50`
   - PDF: `25 50 44 46`
   Disallowed file formats (executables, shell scripts, html) are rejected with `400 Bad Request`.
5. **Category Size Caps:** Strictly enforced upload policies: avatars (5MB), menu (5MB), restaurants (5MB), documents (10MB).

---

## 8. Observability & Telemetry PII Scrubbing

Location: [backend/src/integrations/sentry/sentry.service.ts](file:///C:/Users/HP/Videos/WEB DEV 1.0/Food Delivery/Chovia/backend/src/integrations/sentry/sentry.service.ts)

To maintain compliance with privacy regulations (GDPR, NDPR) and prevent security breaches through telemetry logs:
- **String Sanitization (`sanitizeString`):** Masks Bearer tokens, JWT strings (`[REDACTED_JWT]`), connection credentials (`[REDACTED]`), Paystack keys (`sk_live_[REDACTED]`), and Resend keys (`re_[REDACTED]`).
- **Object Scrubbing (`scrubData`):** Recursively inspects data dictionaries and replaces sensitive keys (passwords, tokens, cookies, CVVs, card numbers, account numbers, BVNs) with `[REDACTED]`.
- **Bounded Recursion & Circular Reference Protection:** `scrubData` utilizes a `WeakSet<object>` visited tracker to detect circular references (`[CIRCULAR]`) and bounds nested structure traversal to a depth of 10 (`[MAX_DEPTH_EXCEEDED]`), preventing call stack exhaustion without mutating original `Error` objects.
- **Sentry Integration Hooks:** All exception events and breadcrumbs pass through `beforeSend` filters before outbound network transmission to Sentry.

---

## 9. Environment & Redis Transport Security

Location: [backend/src/config/env.ts](file:///C:/Users/HP/Videos/WEB DEV 1.0/Food Delivery/Chovia/backend/src/config/env.ts), [backend/src/cache/redis.ts](file:///C:/Users/HP/Videos/WEB DEV 1.0/Food Delivery/Chovia/backend/src/cache/redis.ts)

- **Mandatory Redis TLS (`rediss://`):** In staging and production environments, `REDIS_URL` must use the secure `rediss://` protocol with TLS enabled (`rejectUnauthorized: true`). Plain `redis://` is rejected at boot.
- **Loopback & IPv6 Rejection:** Rejects `localhost`, `127.0.0.1`, `::1`, and `[::1]` for `DATABASE_URL` and `REDIS_URL` in staging and production.
- **Expo Access Token Enforcement:** Requires a non-empty `EXPO_ACCESS_TOKEN` in staging and production to prevent unauthenticated push dispatch.
- **Strict Query String Rejection:** Rejects Redis connection URLs containing query parameters (`url.search`), requiring explicit configuration of connection options and TLS certificates.

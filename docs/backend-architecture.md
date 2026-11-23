# CHOVIA — Backend Architecture Documentation

> **Document:** Backend Architecture and Implementation Specification  
> **Status:** Implemented MVP (Automated test suite passing; staging environment verification required for live external integrations)  
> **Repository Root:** `backend/`  
> **Package Name:** `@chovia/backend`  
> **Technology Stack:** Node.js 24, Fastify 5, TypeScript 5.9, Prisma 7, PostgreSQL 18 (PostGIS), Redis 7, BullMQ, Zod 4  

---

## 1. Architectural Overview

CHOVIA follows a **Modular Monolith** architecture within a Turborepo monorepo. The backend runtime is powered by **Fastify 5**, a high-performance, low-overhead Node.js web framework. The backend exposes a RESTful JSON API documented through OpenAPI 3.1 (Swagger) and is designed with strict domain boundaries, authoritative server-side logic, and strong type safety.

### Core Architectural Decisions

| Aspect | Implementation | Design Rationale |
|---|---|---|
| Architecture Pattern | Modular Monolith | Keeps domain modules cohesive within a single deployable unit while avoiding premature microservice complexity |
| Server Framework | Fastify 5.2 | High throughput, schema-driven serialization, native plugin architecture, and low memory footprint |
| Language & Runtime | TypeScript 5.9 + Node.js 24 | Strong static typing, modern ECMAScript module resolution (`NodeNext`), and strict typechecking |
| Transport & Serialization | REST + JSON + OpenAPI 3.1 | Standardized HTTP methods, explicit request/response DTOs, and automatic interactive Swagger documentation |
| Data Boundary | Zod 4 DTO Layer | Strict validation of untrusted client input; response masking preventing leakage of database internals |
| Authoritative Store | PostgreSQL 18 + Neon + PostGIS | Authoritative source of persistent business records, geospatial indexing, and ACID transactions |
| ORM | Prisma ORM 7 (`@prisma/adapter-pg`) | Type-safe persistence queries with pooled database connections and raw SQL spatial extensions |
| Ephemeral Store | Redis 7 + ioredis | Distributed cache, rate limiting, and BullMQ queue infrastructure with explicit URL parsing and staging guards |
| Background Processing | BullMQ + Transactional Outbox | Asynchronous job processing (emails, notifications, delivery dispatch) backed by durable PostgreSQL `OutboxEvent` |
| Media Management | Cloudinary | Client-side signed uploads with provider signatures and backend magic byte verification |
| Mobile Notifications | Expo Push Service | Authenticated push dispatch with automatic dead token deactivation |
| Observability | Sentry | Distributed tracing and deep PII/credential scrubbing on breadcrumbs, exceptions, and request envelopes |

---

## 2. Directory and Module Organization

The backend application source code is located at [backend/src](file:///C:/Users/HP/Videos/WEB DEV 1.0/Food Delivery/Chovia/backend/src).

```text
backend/
├── src/
│   ├── app.ts                  # Fastify application factory and plugin composition
│   ├── server.ts               # HTTP server entrypoint, port binding, graceful shutdown
│   ├── cache/
│   │   └── redis.ts            # Redis client wrapper with in-memory offline fallback
│   ├── common/
│   │   └── errors/
│   │       ├── api-error.ts    # Typed domain error classes (NotFoundError, ForbiddenError, etc.)
│   │       └── error-handler.ts # Fastify centralized error handler with safe serialization
│   ├── config/
│   │   └── env.ts              # Zod environment variable parsing and validation
│   ├── database/
│   │   └── prisma.ts           # Prisma 7 client instance with pg adapter and health check
│   ├── generated/
│   │   └── prisma/             # Generated Prisma 7 client and model types
│   ├── integrations/
│   │   ├── cloudinary/         # Cloudinary media signatures, magic byte sniffing, size limits
│   │   ├── email/              # Email delivery service abstraction with Resend backend
│   │   ├── expo/               # Expo Push Notification service and dead-token cleanup
│   │   ├── google-maps/        # Google Maps Routes API & Haversine geographic calculator
│   │   ├── paystack/           # Paystack transactions, verification, webhooks, refunds
│   │   ├── resend/             # Resend transactional email API client
│   │   └── sentry/             # Sentry observability with deep PII & secret scrubbing
│   ├── jobs/
│   │   ├── constants/          # BullMQ queue and job name constants
│   │   ├── outbox/             # Transactional OutboxDispatcher for resilient event delivery
│   │   ├── processors/         # BullMQ processors (email, notification, delivery assignment)
│   │   ├── queues/             # BullMQ queue instantiations with SHA-256 opaque job IDs
│   │   └── types/              # Strong job payload TypeScript interfaces
│   ├── modules/
│   │   ├── admin/              # Platform statistics, restaurant/rider verification, audit logs
│   │   ├── addresses/          # Customer delivery addresses with PostGIS Point coordinates
│   │   ├── audit/              # Centralized audit logging service
│   │   ├── auth/               # Registration, login, refresh rotation, OTP email verification
│   │   ├── cart/               # Cart management, one-restaurant rule, price verification
│   │   ├── delivery/           # Rider status, assignment events, pickup, completion, tracking
│   │   ├── favorites/          # Customer favorite menu item toggling and listing
│   │   ├── menu/               # Categories, menu items, availability toggling, restaurant menu
│   │   ├── notifications/      # User notification listing and mark-as-read
│   │   ├── orders/             # Order checkout, idempotency, status transitions, cancellation
│   │   ├── payments/           # Paystack initialization, payment verification, webhook ingestion, refunds
│   │   ├── pricing/            # Authoritative delivery fee and platform commission calculations
│   │   ├── restaurants/        # Public listing, distance filtering, onboarding, availability
│   │   ├── restaurant-staff/   # Staff invitations, invite acceptance, role permissions
│   │   └── users/              # User profile management, device registration, upload verification
│   ├── plugins/
│   │   ├── auth-guard.ts       # Role-based access control (RBAC) and staff authorization guards
│   │   ├── jwt.ts              # Fastify JWT plugin registration wrapped with fastify-plugin
│   │   └── swagger.ts          # OpenAPI 3.1 / Swagger documentation plugin registration
│   ├── tests/
│   │   ├── app.test.ts         # Fastify HTTP integration and health check test suite
│   │   ├── crypto.test.ts      # Password hashing and token generation test suite
│   │   ├── integrations-security.test.ts # Cloudinary, Sentry PII, Redis URL, Env tests
│   │   ├── money-geo.test.ts   # Monetary integer math and Haversine distance test suite
│   │   ├── openapi.test.ts     # OpenAPI 3.1 contract and schema verification suite
│   │   ├── payments.test.ts    # Paystack verification, refunds, state machine & webhook suite
│   │   └── queues-workflows.test.ts # BullMQ queues, opaque job IDs, outbox & delivery processor
│   ├── types/
│   │   └── auth.ts             # JWT payload interface and Fastify module augmentation
│   └── utils/
│       ├── crypto.ts           # Cryptographic token generator, HMAC OTP generator, SHA-256 hash
│       ├── geo.ts              # Haversine distance and duration calculation helpers
│       ├── money.ts            # Integer minor unit calculations and currency formatters
│       └── password.ts         # bcrypt password hashing (12 rounds) and verification
├── package.json                # Dependencies, scripts (dev, build, lint, typecheck, test)
├── tsconfig.json               # Backend TypeScript configuration extending @chovia/config
└── vitest.config.ts            # Vitest unit and integration test runner configuration
```

---

## 3. Layer Separation and Architectural Boundaries

Every domain module adheres to a strict four-layer architectural boundary:

```text
HTTP Request
     │
     ▼
[Transport Layer: *.routes.ts]
     │ Validates input using Zod Request DTO
     │ Checks authentication & RBAC authorization
     ▼
[Application / Service Layer: *.service.ts]
     │ Orchestrates business use cases & invariants
     │ Enforces domain rules (one-restaurant cart, price calculation)
     ▼
[Persistence Layer: prisma.ts / PostGIS Raw SQL]
     │ Executes atomic transactions (prisma.$transaction)
     │ Interacts with PostgreSQL 18 via Prisma 7 Client
     ▼
[Response DTO Serialization]
     │ Serializes database records to explicit Response DTO
     │ Masks password hashes, tokens, and internal database details
     ▼
HTTP JSON Response
```

### Layer Responsibilities

1. **Routes (`*.routes.ts`):**  
   Registers Fastify route handlers under the API prefix (`/api/v1`). Validates incoming request payloads, path parameters, and query strings using Zod schemas. Attaches OpenAPI metadata (summary, description, tags, response status codes). Delegates execution to the module service. Never contains direct database queries or financial calculations.
2. **DTO Layer (`dto/*.dto.ts`):**  
   Implements explicit Request and Response contracts using **Zod 4 schemas** and inferred TypeScript types. Request DTOs strip unrecognized fields, enforce string length constraints, and validate types. Response DTOs define the exact contract exposed to mobile and web clients, ensuring raw Prisma model records are never leaked.
3. **Service Layer (`*.service.ts`):**  
   Encapsulates all domain rules, business invariants, financial arithmetic, and workflow state machines. Validates entity ownership, checks restaurant operating status, computes distance-based delivery fees, and generates audit log entries.
4. **Persistence Layer (`prisma.ts`):**  
   PostgreSQL 18 database access using Prisma ORM 7. For operations involving PostGIS geometry columns (`Address.location` and `Restaurant.location`), parameterized raw SQL (`prisma.$queryRaw`) is used to invoke `ST_SetSRID(ST_MakePoint(lng, lat), 4326)` seamlessly.
5. **Integration Layer (`src/integrations/*`):**  
   Isolates third-party service clients (Paystack, Google Maps, S3/Cloudflare R2, Email). Provides automatic mock fallbacks when running in local development or test mode (`MOCK_INTEGRATIONS=true`), preventing external network dependencies from blocking development.

---

## 4. Plugins and Application Lifecycle

The Fastify application instance is composed in [src/app.ts](file:///C:/Users/HP/Videos/WEB DEV 1.0/Food Delivery/Chovia/backend/src/app.ts):

- **Security Headers:** `@fastify/helmet` configures secure HTTP response headers (Content-Security-Policy, X-Frame-Options, HSTS).
- **CORS:** `@fastify/cors` enables cross-origin requests from CHOVIA mobile applications and web clients with configurable origin white-listing.
- **Rate Limiting:** `@fastify/rate-limit` prevents brute-force abuse by enforcing a maximum of 100 requests per minute per IP address on public endpoints.
- **JWT Authentication:** `@fastify/jwt` handles verification of asymmetric/symmetric JWT access tokens. Wrapped in `fastify-plugin` (`fp`) to break encapsulation and decorate the root Fastify instance with `request.jwtVerify()` and `fastify.authenticate`.
- **OpenAPI / Swagger:** `@fastify/swagger` and `@fastify/swagger-ui` render interactive documentation at `/api/docs` and expose raw OpenAPI JSON at `/api/docs/json`.
- **Centralized Error Handler:** Intercepts `ApiError` instances, Fastify schema validation failures, and uncaught exceptions. Formats errors into a unified JSON structure (`{ statusCode, error: { code, message, details } }`), preventing internal stack traces from leaking in production.
- **Health Check:** `GET /health` tests database connectivity (`SELECT 1`), Redis connection status, memory usage, and application uptime.

### Server Lifecycle and Graceful Teardown

In [src/server.ts](file:///C:/Users/HP/Videos/WEB DEV 1.0/Food Delivery/Chovia/backend/src/server.ts), process signal handlers listen for `SIGINT` and `SIGTERM`:

1. Stops accepting incoming HTTP connections.
2. Drains active HTTP requests with a 10-second timeout.
3. Disconnects Prisma client and terminates the PostgreSQL connection pool.
4. Closes Redis connection.
5. Exits process cleanly with code 0.

---

## 5. Caching and Offline Resilience

The caching abstraction in [src/cache/redis.ts](file:///C:/Users/HP/Videos/WEB DEV 1.0/Food Delivery/Chovia/backend/src/cache/redis.ts) provides a fail-soft mechanism:

- If a live Redis server is reachable at `REDIS_URL`, `ioredis` is utilized for key-value caching, TTL eviction, and distributed lock management.
- If Redis is unreachable or offline during local development and testing, an in-memory `Map` with automatic expiration gracefully replaces Redis operations. This ensures that unit tests, integration tests, and local development environments remain fully functional without requiring a running Docker or Redis daemon.

Similarly, BullMQ queues in [src/jobs/queues/index.ts](file:///C:/Users/HP/Videos/WEB DEV 1.0/Food Delivery/Chovia/backend/src/jobs/queues/index.ts) are lazily initialized. During testing or when `MOCK_INTEGRATIONS=true`, job dispatching is routed to mock loggers rather than hanging on unestablished Redis socket connections.

---

## 6. Transactional Outbox Pattern & Order-Delivery Lifecycle

### 6.1 Transactional Outbox (`OutboxEvent`)
To ensure strict at-least-once processing without losing asynchronous side-effects (push notifications, automated dispatch jobs) if Redis or external services are temporarily restarting, the backend uses the Transactional Outbox Pattern:
1. When state changes occur inside database transactions (e.g. `PaymentsService.processPaymentSuccess` or `OrdersService.markOrderReady`), an `OutboxEvent` record is written inside the same `prisma.$transaction`.
2. The `OutboxDispatcher` periodically or reactively queries pending events, acquires an atomic lock via `prisma.outboxEvent.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'PROCESSING', attempts: { increment: 1 } } })`, and forwards the payload to BullMQ queues (`enqueuePushNotification`, `enqueueDeliveryTimeoutCheck`).
3. Upon successful queueing, the event transitions to `DISPATCHED`. On transient failure, exponential backoff is scheduled until maximum retry attempts (5) are exhausted, transitioning the record to `FAILED` for operational inspection.

### 6.2 Order-Ready vs. Delivery Lifecycle
- **Payment Success:** When payment succeeds, `Payment.status` becomes `SUCCESS` and `Order.status` becomes `CONFIRMED`. The associated `Delivery` is upserted with `status: 'PENDING'` (NOT `READY`), preventing premature rider dispatch while the kitchen has not started cooking.
- **Kitchen Preparation:** The restaurant transitions the order to `PREPARING`.
- **Order Ready (`markOrderReady`):** Once the meal is fully packaged, the restaurant marks the order `READY`. This atomically updates `Order.status` to `READY`, updates `Delivery.status` from `PENDING` to `READY`, inserts an `OutboxEvent` for `DISPATCH_DELIVERY`, and triggers rider proximity dispatch.
- **Rider Proximity Dispatch:** The delivery worker matches active riders with `isOnline: true`, `isAvailable: true`, location freshness (< 30 minutes), and Haversine distance within 10 km of the restaurant. If no rider is immediately available, bounded retries (up to 3 attempts with exponential backoff) run before emitting an `AuditLog` escalation alert for manual dispatch.

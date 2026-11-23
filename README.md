# CHOVIA

CHOVIA is a food-delivery platform made up of a Customer app, a Rider app, a Restaurant (vendor) portal, an Admin dashboard and a Marketing website, all backed by a single Fastify API.

The repository is a **Modular Monolith + Monorepo** managed with **pnpm** and **Turborepo**.

> **Status:** Backend, database and API are implemented (Phases 0-3). The mobile and web applications are foundation scaffolds only; their product screens are planned for Phase 4 onward. See [Project Status](#project-status).

---

## Table of Contents

- [Architecture](#architecture)
- [Repository Layout](#repository-layout)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Scripts](#scripts)
- [Environment Variables](#environment-variables)
- [Backend Overview](#backend-overview)
- [Domain Model](#domain-model)
- [Order and Delivery Lifecycle](#order-and-delivery-lifecycle)
- [Pricing Rules](#pricing-rules)
- [API Reference](#api-reference)
- [Background Jobs](#background-jobs)
- [Integrations](#integrations)
- [Security Model](#security-model)
- [Testing and Quality](#testing-and-quality)
- [Design System](#design-system)
- [Project Status](#project-status)
- [Documentation Index](#documentation-index)
- [Contributing and Agent Rules](#contributing-and-agent-rules)

---

## Architecture

| Area | Decision |
| --- | --- |
| Overall architecture | Modular Monolith |
| Repository | Monorepo (pnpm workspaces + Turborepo) |
| API style | REST + JSON, documented with OpenAPI 3.1 |
| Database | PostgreSQL 18 (Neon) with PostGIS |
| ORM | Prisma ORM 7 with `@prisma/adapter-pg` |
| Auth | JWT access tokens + database-backed refresh-token sessions, bcrypt passwords |
| Validation | Zod 4 on the backend and web, Zod 3 on mobile |
| Cache / queues | Redis (`ioredis`) and BullMQ |

Key principles:

- PostgreSQL is the single source of truth. Redis is only for cache, rate limits, one-time-token consumption and queues.
- Money is computed in integer minor units (kobo) and stored as `Decimal(12,2)` with an explicit currency (`NGN`).
- Routes stay thin; business rules live in services; DTOs (Zod schemas) define every request and response contract.
- Authorization and business rules are enforced on the server, never trusted from clients.

## Repository Layout

```text
Chovia/
├── apps/
│   ├── mobile/
│   │   ├── customer/        # @chovia/mobile-customer  (Expo 58, React Native 0.88, NativeWind)
│   │   └── rider/           # @chovia/mobile-rider     (Expo 58, React Native 0.88, NativeWind)
│   └── web/
│       ├── admin/           # @chovia/web-admin        (Next.js 16, React 19, Tailwind v4)
│       ├── marketing/       # @chovia/web-marketing    (Next.js 16, React 19, Tailwind v4)
│       └── restaurant/      # @chovia/web-restaurant   (Next.js 16, React 19, Tailwind v4)
├── backend/                 # @chovia/backend          (Fastify 5, Prisma 7, Zod 4)
│   └── src/
│       ├── app.ts           # Fastify app factory and plugin composition
│       ├── server.ts        # HTTP entrypoint and graceful shutdown
│       ├── worker.ts        # BullMQ worker entrypoint
│       ├── cache/           # Redis client with dev/test in-memory fallback
│       ├── common/          # Error classes, response types
│       ├── config/          # Zod-validated environment (env.ts)
│       ├── database/        # Prisma client + pg pool
│       ├── generated/       # Generated Prisma client (git-ignored)
│       ├── integrations/    # Paystack, Google Maps, Cloudinary, Resend, Expo Push, Sentry
│       ├── jobs/            # Queues, workers, processors, transactional outbox
│       ├── modules/         # Domain modules (routes, service, dto/)
│       ├── plugins/         # JWT, auth guards, Swagger
│       ├── tests/           # Vitest suites
│       ├── types/           # Fastify/JWT type augmentation
│       └── utils/           # crypto, geo, money, password helpers
├── database/
│   └── prisma/
│       ├── schema.prisma    # Canonical schema (PostgreSQL + PostGIS)
│       ├── migrations/      # 20261122213700_init, 20261123140000_stage_3_2_2_remediation
│       └── seed/            # Seed directory (currently empty)
├── packages/
│   ├── config/              # @chovia/config      shared tsconfigs (base, node, nextjs, expo)
│   ├── types/               # @chovia/types       framework-agnostic primitives (no Prisma types)
│   └── validation/          # @chovia/validation  shared constraints and pure validators
├── api/                     # API docs, OpenAPI JSON/YAML, schema notes
├── docs/                    # Architecture, security, database, environment documentation
├── skills/                  # Agent workflow skills (architect, review, recover, remember, imprint)
├── e2e/                     # Playwright end-to-end tests (placeholder)
├── AGENTS.md                # Rules for AI coding agents
├── TECH-STACK.md            # Authoritative technology reference
├── turbo.json               # Turborepo task pipeline
├── pnpm-workspace.yaml      # Workspace definition
└── prisma7.config.ts        # Prisma 7 CLI configuration
```

Module folders under `backend/src/modules/`: `addresses`, `admin`, `audit`, `auth`, `cart`, `delivery`, `favorites`, `menu`, `notifications`, `orders`, `payments`, `pricing`, `restaurant-staff`, `restaurants`, `users`.

## Tech Stack

**Backend:** Node.js 24, TypeScript 5.9, Fastify 5, `@fastify/jwt`, `@fastify/helmet`, `@fastify/cors`, `@fastify/rate-limit`, `@fastify/swagger`, `@fastify/type-provider-zod`, Zod 4, bcrypt, Prisma 7, `pg`, ioredis, BullMQ, Sentry, Cloudinary, Resend.

**Database:** PostgreSQL 18 on Neon, PostGIS (`geometry(Point,4326)` with GiST indexes), Prisma Migrations.

**Mobile (Customer and Rider):** React Native, Expo 58, Expo Router, NativeWind, Reanimated, TanStack Query, Zustand 5, React Hook Form, Zod 3, Axios.

**Web (Admin, Restaurant, Marketing):** Next.js 16, React 19, Tailwind CSS v4, TanStack Query, TanStack Table, Zustand, React Hook Form, Zod 4, Recharts, date-fns, Axios.

**Tooling:** pnpm 12.6, Turborepo 2, ESLint 10 (flat config), Prettier 3, Vitest 5, Playwright.

**External services:** Paystack (payments), Google Maps Platform (routing/geocoding), Cloudinary (media), Resend (email), Expo Push (notifications), Sentry (monitoring), Neon (database).

Planned but not yet installed in the backend: Socket.IO (real-time), Sharp, AWS S3 SDK / Cloudflare R2 utilities. `TECH-STACK.md` remains the source of truth for approved technology; excluded technologies are Better Auth, class-validator, GraphQL and microservices.

## Getting Started

### Prerequisites

- Node.js `24.22.3` (see `.node-version`; the root `engines` field requires `>=24 <25`)
- pnpm `12.6.x`
- PostgreSQL with the PostGIS extension (Neon or local)
- Redis (optional for local development; the backend falls back to an in-memory cache outside staging/production)

### Install

```bash
pnpm install
```

### Configure the backend

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` with your database URL and secrets. Never commit `.env` files.

### Prepare the database

```bash
pnpm db:validate     # validate schema.prisma
pnpm db:generate     # generate the Prisma client into backend/src/generated/prisma
```

Apply migrations with the Prisma CLI against your database using the schema at `database/prisma/schema.prisma` (config in `prisma7.config.ts`). Run destructive operations (resets, data deletion) only with explicit approval.

### Run

```bash
pnpm --filter @chovia/backend dev        # API on http://localhost:4000
pnpm --filter @chovia/backend worker     # BullMQ workers (separate process)
pnpm --filter @chovia/web-admin dev
pnpm --filter @chovia/web-restaurant dev
pnpm --filter @chovia/web-marketing dev
pnpm --filter @chovia/mobile-customer dev
pnpm --filter @chovia/mobile-rider dev
```

Interactive API docs: `http://localhost:4000/api/docs` (raw spec at `/api/docs/json`).

## Scripts

Root scripts (run from the repository root):

| Command | Description |
| --- | --- |
| `pnpm dev` | Start all apps in dev mode via Turborepo |
| `pnpm build` | Build all packages and apps |
| `pnpm start` | Start built apps |
| `pnpm lint` | ESLint across workspaces |
| `pnpm typecheck` | `tsc --noEmit` across workspaces |
| `pnpm test` | Vitest across workspaces |
| `pnpm e2e` | Playwright end-to-end tests |
| `pnpm clean` | Remove build artifacts |
| `pnpm format` / `pnpm format:check` | Prettier write / check |
| `pnpm db:validate` | Validate the Prisma schema |
| `pnpm db:format` | Format the Prisma schema |
| `pnpm db:generate` | Generate the Prisma client |

Backend scripts (`@chovia/backend`): `dev`, `worker`, `build`, `start`, `lint`, `typecheck`, `test`, `openapi:generate`, `clean`.

## Environment Variables

Variable **names** only; values must stay local. Validation lives in `backend/src/config/env.ts`, and production/staging apply stricter rules (no mock integrations, no localhost database/Redis, distinct non-default secrets, live Paystack key, Sentry DSN required, and so on).

| Group | Variables |
| --- | --- |
| Runtime | `NODE_ENV` (`development`, `test`, `staging`, `production`), `HOST`, `PORT`, `FRONTEND_URL`, `CORS_ORIGIN` |
| Database / cache | `DATABASE_URL`, `DIRECT_URL`, `REDIS_URL` |
| Auth | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN_DAYS` |
| OTP | `OTP_HMAC_SECRET`, `OTP_EXPIRES_IN_MINUTES` |
| Integrations | `MOCK_INTEGRATIONS` |
| Paystack | `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`, `PAYSTACK_WEBHOOK_SECRET` |
| Cloudinary | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |
| Email | `RESEND_API_KEY`, `EMAIL_FROM` |
| Monitoring | `SENTRY_DSN`, `SENTRY_ENVIRONMENT` |
| Google Maps | `GOOGLE_MAPS_API_KEY`, `GOOGLE_MAPS_USE_ROUTES_API` |
| Push | `EXPO_ACCESS_TOKEN` (read directly from `process.env`) |

With `MOCK_INTEGRATIONS=true` (development/test only) Paystack, Google Maps, Cloudinary and email run in offline mock mode, and BullMQ queues/workers are bypassed.

## Backend Overview

Request flow: **route** (Zod DTO validation, auth guards) -> **service** (business rules, transactions) -> **Prisma / raw PostGIS SQL** -> **response DTO** serialization.

- **App composition** (`app.ts`): Zod validator/serializer compilers, raw-body capture for webhooks, CORS allow-list, Helmet, rate limiting (200 req/min; Redis-backed in staging/production), JWT, Swagger, centralized error handler (`{ statusCode, code, message, details, timestamp }`), health endpoints, then all modules under `/api/v1`.
- **Health:** `GET /health`, `GET /health/live`, `GET /health/ready` (checks PostgreSQL and Redis).
- **Auth guards** (`plugins/auth-guard.ts`): `authorize([...roles])` for role checks and `requireRestaurantStaff` for restaurant-scoped staff routes.
- **PostGIS:** models with `geometry(Point,4326)` columns (`Address`, `Restaurant`) are inserted through parameterized raw SQL.
- **Graceful shutdown:** the server closes HTTP, Prisma, workers and Redis on `SIGINT`/`SIGTERM`.

## Domain Model

Main Prisma models (`database/prisma/schema.prisma`):

- **Identity:** `User` (roles `CUSTOMER`, `RESTAURANT_STAFF`, `RIDER`, `ADMIN`), `RefreshToken`, `UserDevice`, `CustomerProfile`, `RiderProfile`
- **Restaurants:** `Restaurant`, `RestaurantStaffMembership`, `StaffInvitation`, `OperatingHours`, `CuisineCategory`, `RestaurantCuisine`
- **Menu:** `MenuCategory`, `MenuItem`
- **Commerce:** `Address`, `Cart`, `CartItem`, `Order`, `OrderItem` (price snapshot), `OrderStatusHistory`, `Favorite`
- **Payments:** `Payment`, `Refund`
- **Delivery:** `Delivery`, `DeliveryAssignmentEvent`
- **Platform:** `Notification`, `AuditLog`, `CommissionConfig`, `DeliveryPricingConfig`, `OutboxEvent`

## Order and Delivery Lifecycle

```text
PENDING_PAYMENT -> CONFIRMED -> PREPARING -> READY -> ASSIGNED -> OUT_FOR_DELIVERY -> DELIVERED
        |              |
        +-> CANCELLED  +-> REJECTED
```

1. **Checkout** builds the order from the cart with server-side pricing and an optional idempotency key; the cart is cleared in the same transaction.
2. **Payment** is initialized with Paystack and confirmed by verification or a signed webhook (amount, currency and reference are checked). Success moves the order to `CONFIRMED`, creates a `Delivery` in `PENDING`, and writes an outbox event for the customer notification.
3. **Restaurant** accepts (`PREPARING`), marks ready (`READY`, delivery becomes `READY` and a dispatch outbox event is written), or rejects.
4. **Rider** accepts (`ASSIGNED`), picks up (`OUT_FOR_DELIVERY`) and completes (`DELIVERED`). An automatic dispatch job can also assign an eligible rider.
5. Every transition is recorded in `OrderStatusHistory`.

## Pricing Rules

Defined in `backend/src/utils/money.ts` and `modules/orders`:

- Delivery fee: 500 NGN base up to 2 km, plus 100 NGN per additional km (rounded up).
- Platform fee: 3% of subtotal, minimum 100 NGN.
- Total = subtotal + delivery fee + platform fee.
- Commissions recorded on the order: 15% of subtotal (restaurant) and 20% of delivery fee (delivery).
- Distance comes from the Google Routes API (two-wheeler); Haversine is used only in development/test fallback.

## API Reference

Base URL: `http://localhost:4000/api/v1`. Protected routes require `Authorization: Bearer <access_token>`. Errors share one envelope:

```json
{ "statusCode": 400, "code": "VALIDATION_ERROR", "message": "Request validation failed", "details": [], "timestamp": "..." }
```

Routes as registered in code:

| Module | Routes |
| --- | --- |
| Auth `/auth` | `POST /register`, `POST /login`, `POST /refresh`, `POST /logout`, `POST /verify-email/request`, `POST /verify-email/verify`, `POST /password-reset/request`, `POST /password-reset/verify`, `POST /password-reset/complete`, `GET /me` |
| Users `/users` | `GET`/`PATCH /profile`, `GET`/`POST /devices`, `DELETE /devices/:deviceId`, `POST /upload-signature`, `POST /upload-image`, `POST /verify-upload` |
| Restaurants `/restaurants` | `GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `PATCH /:id/availability` |
| Staff `/staff` | `POST /invitations/accept`, `POST /restaurants/:restaurantId/staff/invite`, `GET /restaurants/:restaurantId/staff`, `DELETE /restaurants/:restaurantId/staff/:staffId` |
| Menu (root) | `GET /restaurants/:restaurantId/menu`, `POST /restaurants/:restaurantId/categories`, `PATCH`/`DELETE /restaurants/:restaurantId/categories/:categoryId`, `POST /restaurants/:restaurantId/items`, `PATCH`/`DELETE /restaurants/:restaurantId/items/:itemId`, `PATCH /restaurants/:restaurantId/items/:itemId/availability` |
| Addresses `/addresses` | `GET /`, `POST /`, `PATCH /:id`, `PATCH /:id/default`, `DELETE /:id` |
| Cart `/cart` | `GET /`, `POST /items`, `PATCH /items/:id`, `DELETE /items/:id`, `DELETE /` |
| Orders `/orders` | `POST /checkout`, `GET /`, `GET /:id`, `POST /:id/cancel`, `POST /:id/accept`, `POST /:id/ready`, `POST /:id/reject` |
| Payments `/payments` | `POST /initialize`, `GET /verify/:reference`, `POST /webhook`, `POST /refund` |
| Delivery (root) | `PATCH /riders/status`, `GET /riders/deliveries/available`, `POST /riders/deliveries/:deliveryId/accept`, `.../pickup`, `.../complete`, `GET /deliveries/:orderId/track` |
| Notifications `/notifications` | `GET /`, `PATCH /:id/read`, `PATCH /read-all` |
| Pricing `/pricing` | `POST /estimate`, `GET /configs` |
| Favorites `/favorites` | `GET /`, `POST /:menuItemId` |
| Admin `/admin` | `GET /metrics`, `PATCH /restaurants/:id/status`, `PATCH /riders/:id/status`, `GET /audit-logs` |

The generated specs live in `api/openapi/` (`openapi.json`, `openapi.yaml`); regenerate with `pnpm --filter @chovia/backend openapi:generate`. Some older prose in `docs/` and `api/docs/` describes earlier route shapes; the OpenAPI output and the code are authoritative.

## Background Jobs

BullMQ queues (Redis) with workers started by `backend/src/worker.ts`:

| Queue | Jobs |
| --- | --- |
| `email-notifications` | verification email, password-reset email, staff-invite email |
| `push-notifications` | in-app notification record + Expo push |
| `delivery-dispatch` | delivery dispatch / timeout check with retries |

A **transactional outbox** (`OutboxEvent`) makes post-payment notifications and delivery dispatch durable: events are written in the same transaction as the state change, claimed atomically, retried with exponential backoff and marked `FAILED` after 5 attempts. Jobs must be retry-safe and idempotent.

## Integrations

| Service | Purpose | Notes |
| --- | --- | --- |
| Paystack | Payments, refunds | HMAC-SHA512 webhook verification; amount/currency/reference checks; live key required in production |
| Google Maps | Routing and geocoding | Routes API for distance; Haversine fallback only outside staging/production |
| Cloudinary | Image and document uploads | Signed direct uploads or server upload; per-folder format and size policies; magic-byte inspection for base64 |
| Resend | Transactional email | Queue first, direct-send fallback |
| Expo Push | Mobile push | Invalid tokens are deactivated automatically |
| Sentry | Error monitoring | Deep scrubbing of tokens, passwords, OTPs and keys before sending |

## Security Model

- Passwords hashed with bcrypt; access tokens are short-lived JWTs (default 15 minutes).
- Refresh tokens are stored hashed (SHA-256) in PostgreSQL with family rotation and reuse detection.
- Email verification and password reset use HMAC-signed 6-digit OTPs with single-use consumption tracked in Redis.
- Strict Zod DTOs (`.strict()`) on request bodies; explicit response DTOs, never raw Prisma records.
- Rate limiting globally and on OTP endpoints; Helmet and an origin allow-list for CORS.
- Money amounts, totals and commissions are derived on the server; payments are confirmed against the provider, not the client.
- Production/staging fail fast on insecure configuration (see [Environment Variables](#environment-variables)).
- Secrets live in environment variables only. `.env*` files are git-ignored (templates excepted).

Role-based and resource-level authorization is part of the design (`authorize`, `requireRestaurantStaff`, ownership checks in services). Hardening and verifying these checks route by route is part of the ongoing backend review.

## Testing and Quality

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm e2e
```

Backend Vitest suites (`backend/src/tests/`): app/health and validation, crypto, money/geo, Paystack and webhook security, integrations security (environment schema, Sentry scrubbing, Redis URL parsing, Cloudinary, Google Maps), queue fallbacks and OpenAPI contract checks. ESLint forbids `any` and enforces consistent type imports; TypeScript runs in strict mode.

## Design System

| Token | Value |
| --- | --- |
| Primary green | `#235347` |
| Deep green | `#0D2621` |
| Gold | `#D4AF37` |
| Soft background | `#F5F7F6` |
| White | `#FFFFFF` |
| Typeface | Manrope |

The customer app exposes these as NativeWind tokens (`chovia-green`, `chovia-deep`, `chovia-gold`, `chovia-background`). Use the approved CHOVIA logo and keep accessibility and responsive standards.

## Project Status

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Monorepo bootstrap | Completed |
| 1 | Database and domain foundation | Completed |
| 2 | Monorepo foundation and tooling | Completed |
| 3 | Backend, database and API implementation | Completed (under ongoing review and hardening) |
| 4+ | Mobile and web product screens | Pending planning |

- All five front-end applications currently render placeholder foundation screens; folders such as `components/`, `hooks/`, `services/` and `store/` are empty scaffolds.
- The seed directory is empty, and there is no user-facing flow yet for onboarding riders or admins.
- Real-time delivery (Socket.IO) is planned, not implemented.

## Documentation Index

- `AGENTS.md` - working rules for AI agents and engineering conventions
- `TECH-STACK.md` - approved stack and phase progress
- `docs/monorepo-foundation.md`, `docs/backend-architecture.md`, `docs/backend-api.md`, `docs/backend-database.md`, `docs/backend-environment.md`, `docs/backend-integrations.md`, `docs/backend-security.md`
- `api/docs/` - authentication, endpoints, errors, payments, webhooks, uploads, integrations
- `api/openapi/` - generated OpenAPI specifications

## Contributing and Agent Rules

- Read `AGENTS.md` and `TECH-STACK.md` before changing anything; inspect the repository rather than assuming.
- Do not introduce Better Auth, class-validator, GraphQL or microservices, and do not silently swap approved technologies.
- Use DTOs for every API boundary; keep route handlers thin; never expose Prisma models or spread request bodies into Prisma calls.
- Use migrations for schema changes; no destructive database operations without explicit approval.
- Never open, print or commit `.env` files or secrets.
- Report only commands you actually ran and the results you actually observed.

Skills for structured workflows live in `skills/` (`architect`, `review`, `recover`, `remember`, `imprint`, `frontend-design`).

## License

Private repository (`"private": true` in `package.json`). No license file is present.

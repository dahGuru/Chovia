# CHOVIA — AI Agent Instructions

> This file defines the working rules for AI coding agents operating in the CHOVIA repository.
> Read this file together with `TECH-STACK.md`, the relevant project documentation, skills, and the active phase brief before making changes.

## 1. Project Context

CHOVIA is a food-delivery platform with Customer, Rider, Vendor, Admin, and Marketing applications.

The approved architecture is a **Modular Monolith + Monorepo**. The approved technology stack is documented in `TECH-STACK.md`; that file is the source of truth for technology choices.

Do not assume that every planned application, package, module, or integration already exists. Inspect the repository and distinguish implemented functionality from planned functionality.

## 2. Mandatory First Steps

Before changing anything:

1. Read this `AGENTS.md`.
2. Read `TECH-STACK.md`.
3. Inspect the repository structure, package manifests, lockfile, TypeScript configuration, and existing conventions.
4. Read relevant documentation and the active phase prompt, if present.
5. Read applicable skills under the repository's `skills/` directory.
6. Identify the exact scope of the request and the files it may affect.
7. Check the current implementation before proposing a replacement.

Do not assume paths, scripts, package names, dependencies, or implementation status. Verify them in the repository.

## 3. Approved Architecture and Stack

Follow `TECH-STACK.md`. Key architectural decisions include:

- Modular Monolith + Monorepo.
- pnpm + Turborepo.
- TypeScript.
- Fastify backend.
- REST + JSON + OpenAPI.
- PostgreSQL 18 + Neon + PostGIS.
- Prisma ORM 7.
- JWT authentication and bcrypt password hashing.
- Zod 4 for backend validation.
- Zod 3 for mobile form validation, scoped to the relevant frontend packages.
- Axios for frontend HTTP communication.
- Redis + ioredis for cache and infrastructure operations.
- BullMQ for background jobs.
- Socket.IO for real-time communication.

Do not introduce Better Auth, class-validator, GraphQL, or a microservices architecture. Do not silently replace an approved technology.

## 4. Architectural Boundaries

Keep clear separation between:

- HTTP transport and routing.
- Request/response validation and DTOs.
- Application use cases and orchestration.
- Domain rules and business invariants.
- Persistence and Prisma/database access.
- External integrations.
- Background jobs and real-time event delivery.

Routes/controllers should remain thin. They should validate and translate transport input, invoke the appropriate application/service operation, and return a deliberate response.

Do not put substantial business logic in route handlers, UI screens, Prisma schema files, or generic utility modules.

Keep modules domain-oriented. A module should own its relevant business operations and contracts. Avoid circular dependencies and unnecessary cross-module access to internal implementation details.

## 5. Backend DTO Layer — Required Convention

CHOVIA uses a **Data Transfer Object (DTO) layer** at the backend API boundary.

DTOs define the data accepted from API clients and the data returned to API clients. They are transport contracts; they are not database models and are not a substitute for authorization or business validation.

### 5.1 DTO implementation approach

- Implement backend DTO contracts with **Zod 4 schemas and inferred TypeScript types**.
- Do not introduce class-based DTOs, class-transformer, or class-validator.
- Use separate schemas for request input and response output.
- Treat all client input as untrusted, even when it originates from CHOVIA's own mobile or web applications.
- Validate at the API boundary before application logic uses request data.
- Validate or construct response DTOs before returning externally visible data where appropriate.
- Keep DTOs explicit, narrow, and purpose-specific.
- Do not use Prisma model types as public API contracts.
- Do not return raw Prisma records directly from routes.

A DTO is a data contract, not a security boundary by itself. Authorization, ownership checks, business invariants, and database constraints must still be enforced independently.

### 5.2 Recommended module layout

Adapt this layout to the repository's actual backend location and existing conventions. Do not create duplicate or speculative backend roots.

```text
<backend-root>/
└── src/
    ├── modules/
    │   ├── auth/
    │   │   ├── auth.routes.ts
    │   │   ├── auth.controller.ts
    │   │   ├── auth.service.ts
    │   │   ├── auth.repository.ts
    │   │   └── dto/
    │   │       ├── login-request.dto.ts
    │   │       ├── register-request.dto.ts
    │   │       ├── auth-response.dto.ts
    │   │       └── index.ts
    │   │
    │   ├── users/
    │   │   └── dto/
    │   │       ├── update-user-request.dto.ts
    │   │       ├── user-response.dto.ts
    │   │       └── index.ts
    │   │
    │   └── orders/
    │       └── dto/
    │           ├── create-order-request.dto.ts
    │           ├── order-response.dto.ts
    │           └── index.ts
    │
    ├── common/
    │   ├── errors/
    │   ├── http/
    │   └── validation/
    └── ...
```

This is a convention, not an instruction to create all these modules immediately. Use the existing repository structure if it already provides an equivalent organization.

### 5.3 Request DTOs

Create purpose-specific request DTOs for operations such as:

- Creating a resource.
- Updating a resource.
- Listing/filtering resources.
- Authentication requests.
- Performing a business action.

Examples of naming:

- `CreateUserRequestDto`
- `UpdateUserRequestDto`
- `LoginRequestDto`
- `CreateOrderRequestDto`
- `ListOrdersQueryDto`

The TypeScript type names may use the `Dto` suffix. Zod schema names should clearly identify the contract, for example `createOrderRequestSchema`.

Request DTO rules:

1. Explicitly define allowed fields.
2. Reject or deliberately strip unknown fields according to the API's documented validation policy; do not silently trust them.
3. Validate types, lengths, formats, ranges, and allowed enum values.
4. Normalize input only when normalization is part of the documented contract.
5. Never accept trusted identity, role, ownership, price, payment status, or privileged fields merely because the client submits them.
6. Derive authenticated user identity from the verified authentication context, not from a client-supplied `userId`.
7. Derive prices, totals, commissions, discounts, and other authoritative financial values on the server.
8. Validate query parameters and path parameters as well as request bodies.

For partial updates, explicitly define which fields may be updated. Do not automatically expose every field from a database model through a generic update DTO.

### 5.4 Response DTOs

Create explicit response DTOs for data returned by the API.

Examples:

- `UserResponseDto`
- `RestaurantResponseDto`
- `MenuItemResponseDto`
- `OrderResponseDto`
- `PaginatedOrdersResponseDto`

Response DTO rules:

1. Return only fields the requesting client is allowed to see.
2. Never expose password hashes, password reset tokens, OTP secrets, authentication secrets, private provider credentials, or internal security fields.
3. Do not expose internal database fields simply because Prisma returns them.
4. Do not expose another user's private information.
5. Use deliberate serialization and mapping from domain/application or persistence data to the response contract.
6. Keep response names and formats stable and documented through OpenAPI.
7. Handle dates, monetary amounts, nullable values, and identifiers consistently.
8. Do not return database relation graphs without explicitly designing the response shape.

A Prisma model changing must not automatically change the public API response.

### 5.5 DTOs and Prisma models

Keep these concepts separate:

- **Prisma model:** persistence representation.
- **Domain entity/value:** business representation and invariants, where the module needs them.
- **Request DTO:** validated data accepted from an API client.
- **Response DTO:** deliberate data exposed by the API.
- **Database record:** data retrieved from persistence.

Map between these representations explicitly where their responsibilities differ. Do not create pointless mapping layers when two representations are genuinely identical and the boundary remains safe; however, public response contracts must remain deliberate and must not expose raw persistence objects.

Never import Prisma-generated model types into frontend applications as a substitute for API contracts.

### 5.6 DTO validation and Fastify

- Use Zod 4 as the backend validation source.
- Integrate validation with Fastify using the repository's existing compatible approach.
- Validate body, params, querystring, and relevant response data.
- Keep validation errors consistent and avoid leaking stack traces or internal implementation details.
- Keep OpenAPI documentation aligned with the actual DTO schemas and route behavior.
- Do not add a new validation integration package without checking existing dependencies and compatibility first.

Do not assume that a Zod schema automatically provides Fastify validation or OpenAPI generation. Verify the installed integration and configure it correctly.

### 5.7 DTO example

Illustrative pattern only. Adapt naming, imports, and file locations to the actual codebase.

```ts
import { z } from "zod";

export const createOrderRequestSchema = z
  .object({
    storeId: z.string().uuid(),
    deliveryAddressId: z.string().uuid(),
    items: z
      .array(
        z
          .object({
            menuItemId: z.string().uuid(),
            quantity: z.number().int().min(1).max(50),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

export type CreateOrderRequestDto = z.infer<typeof createOrderRequestSchema>;

export const orderResponseSchema = z
  .object({
    id: z.string().uuid(),
    status: z.string(),
    currency: z.string(),
    totalMinor: z.number().int(),
    createdAt: z.string().datetime(),
  })
  .strict();

export type OrderResponseDto = z.infer<typeof orderResponseSchema>;
```

The example intentionally does not accept a client-supplied customer ID, item price, subtotal, delivery fee, discount, or payment status. The server obtains the authenticated customer from the verified request context and calculates authoritative amounts using trusted data.

## 6. Security Requirements

Security must be enforced on the server, not assumed from frontend behavior.

- Verify JWTs on protected routes.
- Enforce role-based and resource-level authorization.
- Check ownership for customer, vendor, rider, and administrative resources.
- Never trust client-supplied role or identity claims without verified server-side authentication.
- Hash passwords with bcrypt; never store plaintext passwords.
- Protect OTP, password-reset, and payment workflows.
- Validate all external input.
- Use parameterized database queries.
- Avoid mass assignment: never spread arbitrary request bodies into Prisma create/update data.
- Explicitly select and serialize safe fields.
- Do not log passwords, tokens, OTPs, payment secrets, or sensitive personal data.
- Keep secrets out of source control and agent output.
- Apply rate limits to sensitive endpoints.
- Verify payment events with the payment provider; do not trust a client success screen as proof of payment.
- Make payment and other critical state transitions idempotent.

DTO validation does not replace authorization. A valid DTO can still describe an operation the caller is not allowed to perform.

## 7. Database and Data Integrity

- PostgreSQL is the authoritative source of persistent business data.
- Use Prisma ORM 7 according to the installed project configuration.
- Use migrations for schema changes.
- Use foreign keys, unique constraints, check constraints, and indexes where appropriate.
- Use transactions for operations that must succeed or fail atomically.
- Store money as integer minor units with an explicit currency.
- Use PostGIS for geospatial requirements.
- Use parameterized raw SQL when required for spatial operations not adequately expressed by Prisma.
- Do not use Redis as the source of truth for orders, payments, users, balances, or other business records.
- Never run destructive migrations, resets, or data deletion without explicit approval.

## 8. Mobile Application Structure

For Customer and Rider applications, follow the approved Expo Router structure where it matches the existing repository:

```text
<mobile-app>/
├── app/
│   ├── _layout.tsx
│   ├── index.tsx
│   ├── (auth)/
│   ├── (tabs)/
│   ├── menu/
│   ├── orders/
│   ├── restaurant/
│   └── profile/
├── components/
├── hooks/
├── services/
├── patches/
├── store/
├── utils/
└── assets/
```

Responsibilities:

- `app/`: route files and navigation composition.
- `components/`: reusable presentation components.
- `hooks/`: reusable React behavior.
- `services/`: API and external communication.
- `patches/`: intentional third-party dependency patches only.
- `store/`: Zustand client-side state.
- `utils/`: general-purpose pure helpers.
- `assets/`: images, icons, fonts, and other static resources.

Keep route files focused on composing screens and navigation. Do not put all feature logic in route files.

Use TanStack Query for server state and Zustand for client-side/transient state. Avoid maintaining duplicate authoritative copies of server data in Zustand.

## 9. Frontend and Backend Contracts

- The backend owns the authoritative API contract.
- Keep request and response DTOs aligned with OpenAPI documentation.
- Frontend types must reflect the API contract, not Prisma models.
- Do not duplicate backend business rules in the frontend as a security measure.
- Frontend validation improves user experience; backend validation remains mandatory.
- Handle API errors consistently and safely.
- Do not expose backend-only fields to frontend packages.

If shared contract packages are introduced, inspect the monorepo's package conventions first. Respect the approved Zod major-version separation; do not casually share Zod 4 schemas with a Zod 3 frontend package.

## 10. Redis, Jobs, and Real-time Events

- Redis is for cache, distributed locks, rate limits, and queue infrastructure.
- BullMQ handles asynchronous and scheduled work.
- Jobs must be retry-safe and tolerate duplicate delivery.
- Critical job handlers must be idempotent.
- Define retry, backoff, timeout, and failure behavior deliberately.
- Socket.IO is a transport for real-time events, not the source of truth.
- Persist authoritative business changes before broadcasting corresponding events.
- Do not use Socket.IO as a replacement for ordinary REST resource operations.

## 11. Code Quality

- Use TypeScript deliberately; avoid `any` unless there is a documented and justified reason.
- Prefer clear names and small, cohesive functions.
- Avoid premature abstractions and unnecessary dependencies.
- Keep modules focused and avoid circular dependencies.
- Reuse existing project patterns when they are sound.
- Do not suppress TypeScript, ESLint, or test errors merely to make checks pass.
- Add tests for important business rules, authorization, validation, and failure cases.
- Do not claim tests, builds, or commands passed unless they were actually run and their results observed.

## 12. Change Management and Approval

Unless the user explicitly authorizes implementation:

1. Inspect the relevant code.
2. Explain the current behavior and findings.
3. Present the proposed approach, affected files, risks, and verification plan.
4. Wait for approval before substantial edits.

Do not silently:

- Reorganize the repository.
- Rename or delete files.
- Add, remove, or upgrade dependencies.
- Change database schema or migrations.
- Change authentication or authorization behavior.
- Modify payment, order, pricing, or delivery workflows.
- Change deployment or environment configuration.
- Implement features outside the active phase.

Small, explicitly requested edits may be performed directly, but still inspect the target first.

## 13. Secrets and Local Environment

- Do not open, print, copy, or expose `.env` files or secret-bearing configuration unless the user explicitly asks.
- Do not include credentials in terminal output, reports, screenshots, commits, or generated documentation.
- Do not run commands that dump all environment variables.
- Do not modify local environment files without explicit authorization.
- If a task requires a secret, explain which variable name is needed; do not ask the user to paste its value into chat when a local configuration method is available.

## 14. Verification

After an approved implementation:

1. Inspect the diff and confirm only intended files changed.
2. Run the relevant existing lint command.
3. Run the relevant TypeScript typecheck.
4. Run targeted tests, then broader tests when appropriate.
5. Run the relevant build.
6. Report commands and actual results accurately.
7. Identify anything not tested, blocked, or still requiring a decision.

Discover scripts from the actual package manifests. Do not invent script names.

## 15. Required Completion Report

At the end of a task, report:

- What was inspected.
- What was changed.
- Why the change was necessary.
- Files created, modified, or deleted.
- Dependencies changed, if any.
- Commands executed and their actual results.
- Tests and checks not run, with reasons.
- Remaining risks, assumptions, and decisions requiring user approval.

## 16. Conflict Resolution

If instructions or repository evidence conflict, do not silently choose a new architecture.

Use this order:

1. The user's latest explicit instruction for the current task.
2. This `AGENTS.md` for general agent behavior and engineering rules.
3. `TECH-STACK.md` for approved technology choices.
4. Relevant approved architecture/product documentation.
5. The active phase prompt for phase-specific scope.
6. Existing repository conventions, provided they do not conflict with the above.

If a conflict remains, explain it and ask one focused question before making a consequential decision.

---

**Core rule:** Inspect before acting. Keep boundaries explicit. Validate API input and output with DTO contracts. Enforce authorization independently. Protect secrets. Make only approved changes. Verify every claimed result.

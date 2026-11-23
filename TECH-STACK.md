# **CHOVIA — Complete Technology Stack**

> **Purpose:** Authoritative stack reference for CHOVIA developers and
> AI coding agents. Read this with `AGENTS.md`, project documentation,
> and the active phase prompt before making changes.

> **Product:** Food-delivery platform with Customer, Rider, Vendor,
> Admin, and Marketing/Web applications.

## **1. Architecture**

| Area                        | Technology / Approach                 |
| --------------------------- | ------------------------------------- |
| Overall Architecture        | Modular Monolith                      |
| Repository Architecture     | Monorepo                              |
| Package Manager             | pnpm                                  |
| Monorepo Management         | Turborepo                             |
| Backend Architecture        | Modular, domain-oriented architecture |
| Client–Server Communication | REST API                              |
| Data Exchange Format        | JSON                                  |
| API Documentation           | OpenAPI                               |
| Primary Database            | PostgreSQL                            |
| ORM                         | Prisma ORM 7                          |
| Cache / Infrastructure      | Redis                                 |
| Background Jobs             | BullMQ                                |
| Real-time Communication     | Socket.IO                             |

**Architecture principles:**

- Modular Monolith + Monorepo.
- Clear separation between applications, backend modules, and shared packages.
- PostgreSQL is the authoritative source of persistent business data.
- Redis is used for caching, distributed locks, rate limiting, and queue infrastructure.
- REST handles normal resource operations.
- Socket.IO handles real-time event delivery.
- Background jobs must support retries and idempotent processing.
- Authorization and business rules must be enforced on the backend.

## **2. Frontend Stack**

### **A. Mobile Applications — Customer & Rider**

| Technology              | Responsibility                             |
| ----------------------- | ------------------------------------------ |
| React Native            | Mobile application framework               |
| Expo                    | React Native development platform          |
| Expo Router             | File-based navigation and routing          |
| TypeScript              | Programming language                       |
| NativeWind              | Utility-first styling                      |
| React Native Reanimated | Animations                                 |
| React Native Skia       | Advanced graphics and rendering            |
| TanStack Query          | Server-state management                    |
| Zustand 5               | Client-side and transient state management |
| React Hook Form         | Form management                            |
| Zod 3                   | Form/schema validation                     |
| Axios                   | HTTP client and API communication          |

**Implementation guidelines:**

- Expo Router for application navigation.
- TanStack Query for server state, caching, and API mutations.
- Zustand for client-side state.
- React Hook Form + Zod 3 for form handling and validation.
- Reanimated for advanced animations.
- Skia for custom graphics and rendering where required.
- Use the latest stable Reanimated version compatible with the project's Expo SDK.

### **B. Web Applications — Vendor, Admin & Marketing**

| Technology      | Responsibility                    |
| --------------- | --------------------------------- |
| Next.js         | Web application framework         |
| React           | UI library                        |
| TypeScript      | Programming language              |
| Tailwind CSS    | Styling                           |
| TanStack Query  | Server-state management           |
| Zustand         | Client-side state management      |
| React Hook Form | Form management                   |
| Axios           | HTTP client and API communication |
| TanStack Table  | Data tables                       |
| Recharts        | Charts and data visualization     |
| date-fns        | Date formatting and manipulation  |

**Implementation guidelines:**

- Next.js for web applications.
- TanStack Query for API/server state.
- Zustand for client-side state.
- React Hook Form for forms.
- Axios for API requests.
- TanStack Table for data-heavy tables.
- Recharts for dashboards and analytics.

## **3. Backend Stack**

| Technology                  | Responsibility                            |
| --------------------------- | ----------------------------------------- |
| Node.js                     | Server runtime                            |
| TypeScript                  | Backend programming language              |
| Fastify                     | HTTP server and routing                   |
| JWT                         | Authentication                            |
| bcrypt                      | Password hashing                          |
| Zod 4                       | Backend request/response validation       |
| Prisma ORM 7                | Database access and ORM                   |
| Redis                       | Caching, distributed locks, rate limits   |
| ioredis                     | Redis client                              |
| BullMQ                      | Background job processing                 |
| Sentry                      | Error tracking and performance monitoring |
| AWS SDK for JavaScript (S3) | S3-compatible object-storage operations   |
| Cloudinary                  | Image and media management                |
| Cloudflare R2 utilities     | Cloudflare R2 integration                 |
| Sharp                       | Image processing and optimization         |
| Pino                        | Structured logging                        |

**Implementation guidelines:**

- Fastify handles API routing and HTTP request processing.
- JWT handles authentication tokens.
- bcrypt handles password hashing.
- Zod 4 validates backend request data.
- Prisma handles relational database operations.
- Redis handles caching and infrastructure-level operations.
- BullMQ handles asynchronous and scheduled tasks.
- Pino handles structured application logging.
- Sentry handles error monitoring and performance tracking.

## **4. Database Stack**

| Technology           | Responsibility                            |
| -------------------- | ----------------------------------------- |
| PostgreSQL 18        | Primary relational database               |
| Neon                 | Managed PostgreSQL hosting                |
| PostGIS              | Geospatial data and queries               |
| Prisma ORM 7         | ORM and database modelling                |
| Prisma Migrations    | Database schema migrations                |
| `@prisma/adapter-pg` | Prisma PostgreSQL driver adapter          |
| `pg`                 | Node.js PostgreSQL driver                 |
| Redis                | Caching and ephemeral infrastructure data |

**Database principles:**

1. PostgreSQL remains the source of truth.
2. Use foreign keys, unique constraints, check constraints, and indexes.
3. Use transactions for operations requiring atomicity.
4. Store monetary values as integer minor units (e.g. kobo), alongside an explicit currency.
5. Use PostGIS for geospatial operations.
6. Use GiST indexes where appropriate for spatial queries.
7. Use parameterized raw SQL for PostGIS operations that Prisma cannot adequately express.
8. Manage schema changes through Prisma Migrations.
9. Redis must not become the authoritative store for business records.

## **5. API & Communication Stack**

| Technology                | Responsibility                      |
| ------------------------- | ----------------------------------- |
| REST                      | API architecture                    |
| JSON                      | Request and response format         |
| Fastify                   | API server                          |
| OpenAPI                   | API specification and documentation |
| Zod 4                     | Backend validation                  |
| Axios                     | Frontend HTTP client                |
| JWT Bearer Authentication | Protected API authentication        |
| Socket.IO                 | Real-time communication             |

**API conventions:**

- Versioned API endpoints.
- Consistent success and error response structures.
- Appropriate HTTP status codes.
- Server-side request validation.
- Server-side authorization and ownership checks.
- OpenAPI documentation.
- JWT Bearer authentication through:

```
Authorization: Bearer <token>
```

- REST for standard resource operations.
- Socket.IO for real-time updates where necessary.

## **6. Authentication & Validation**

| Technology      | Responsibility           |
| --------------- | ------------------------ |
| JWT             | Authentication tokens    |
| bcrypt          | Password hashing         |
| Zod 4           | Backend API validation   |
| Zod 3           | Mobile form validation   |
| React Hook Form | Frontend form management |

**Important Zod version distinction:**

- Zod 4 is used in the backend.
- Zod 3 is used for mobile form validation.
- Keep dependencies scoped to the packages that require them.
- Do not assume Zod 3 and Zod 4 schemas are directly interchangeable.

**Explicit exclusion:** `class-validator` is not part of the CHOVIA stack.

## **7. Cache, Background Jobs & Real-time Infrastructure**

| Technology | Responsibility                      |
| ---------- | ----------------------------------- |
| Redis      | Cache, locks, rate limiting         |
| ioredis    | Redis client                        |
| BullMQ     | Background jobs and scheduled tasks |
| Socket.IO  | Real-time event communication       |

**Implementation principles:**

- Redis handles ephemeral data and infrastructure operations.
- BullMQ handles asynchronous processing.
- Jobs must be retry-safe and tolerate duplicate execution.
- Critical operations must be idempotent.
- Distributed locks must have expiration and failure-handling mechanisms.
- Socket.IO communicates relevant state changes after authoritative operations succeed.
- PostgreSQL remains the source of truth.

## **8. File Storage & Media Processing**

| Technology                  | Responsibility                     |
| --------------------------- | ---------------------------------- |
| AWS SDK for JavaScript (S3) | S3-compatible storage operations   |
| Cloudflare R2 utilities     | Cloudflare R2 integration          |
| Cloudinary                  | Image and media storage/management |
| Sharp                       | Image processing and optimization  |

**Implementation principles:**

- Use the appropriate storage provider for each asset and workflow.
- Do not unnecessarily duplicate every file across storage providers.
- Keep provider-specific operations behind interfaces where beneficial.
- Store file metadata and ownership information in PostgreSQL.
- Validate uploaded files on the backend.
- Apply appropriate file-size, MIME-type, and authorization checks.

## **9. External Services & Integrations**

| Service                 | Responsibility                                 |
| ----------------------- | ---------------------------------------------- |
| Paystack                | Payment processing                             |
| Google Maps Platform    | Maps, geocoding, routes, and location services |
| Resend                  | Transactional email delivery                   |
| Expo Push Notifications | Mobile push notifications                      |
| Neon                    | Managed PostgreSQL hosting                     |
| Sentry                  | Error monitoring                               |

Credentials must be stored securely in environment variables or an approved secrets-management system. Never expose credentials in logs, source control, or agent reports.

## **10. Testing & Quality Assurance**

| Technology                   | Responsibility               |
| ---------------------------- | ---------------------------- |
| Vitest                       | Unit and integration testing |
| Playwright                   | Web end-to-end testing       |
| React Native Testing Library | Mobile component testing     |
| ESLint                       | Code linting                 |
| Prettier                     | Code formatting              |

**Quality guidelines:**

- Test business logic and critical workflows.
- Test authorization and validation boundaries.
- Test failure scenarios.
- Test payment and background-job idempotency.
- Run linting, type checking, tests, and builds after relevant changes.
- Never claim a test or build passed without executing it.

## **11. Development Tools & Monorepo Tooling**

| Technology | Responsibility              |
| ---------- | --------------------------- |
| pnpm       | Package manager             |
| Turborepo  | Monorepo task orchestration |
| TypeScript | Programming language        |
| Git        | Version control             |
| ESLint     | Code quality                |
| Prettier   | Code formatting             |

## **12. CHOVIA Design System**

| Design Element  | Value     |
| --------------- | --------- |
| Primary Green   | `#235347` |
| Deep Green      | `#0D2621` |
| Gold            | `#D4AF37` |
| Soft Background | `#F5F7F6` |
| White           | `#FFFFFF` |
| Typeface        | Manrope   |

**Brand guidelines:**

- Preserve the existing approved CHOVIA logo.
- Maintain consistent use of the approved brand colors.
- Use Manrope as the primary typeface.
- Follow platform-specific UI conventions.
- Maintain accessibility and responsive design standards.

## **13. Explicitly Excluded Technologies**

The following technologies are not part of the approved CHOVIA stack:

| Technology                    | Reason                                              |
| ----------------------------- | --------------------------------------------------- |
| Better Auth                   | Explicitly excluded; JWT authentication is selected |
| class-validator               | Zod is selected for validation                      |
| GraphQL                       | REST + OpenAPI is selected                          |
| Microservices                 | Modular Monolith is the selected architecture       |
| Redis as primary database     | PostgreSQL is the authoritative database            |
| Socket.IO as REST replacement | Socket.IO is only for real-time communication       |

Do not introduce replacement technologies without first explaining the technical reason and obtaining approval where necessary.

## **14. Current Project Progress**

| Phase          | Description                                     | Status                  |
| -------------- | ----------------------------------------------- | ----------------------- |
| Phase 0        | Monorepo Bootstrap                              | Completed               |
| Phase 1        | Database & Domain Foundation                    | Completed               |
| Phase 2        | Monorepo Foundation & Tooling Implementation    | Completed               |
| Phase 3        | Complete Backend, Database & API Implementation | Completed               |
| Phase 4 onward | Mobile & Web Frontend Applications              | Pending planning/review |

The actual repository and approved phase plans remain the authority for implementation status. A technology appearing in this document does not automatically mean it has already been installed or configured.

## **15. Instructions for AI Coding Agents**

Before working on CHOVIA:

1. Read `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md` where present.
2. Read relevant documentation under `docs/`.
3. Read applicable skills under `.agents/skills/`.
4. Read the current phase prompt under `prompts/`.
5. Inspect the actual repository structure and existing implementation before proposing changes.
6. Follow the approved technology stack and current phase scope.
7. Do not implement future-phase features unless explicitly requested.
8. For substantial changes, present an implementation plan and wait for approval where required.
9. Do not restructure folders or replace working implementations without understanding their purpose and impact.
10. Do not open, print, expose, or copy `.env` files or credentials unless explicitly authorized.
11. Do not install, remove, upgrade, or replace dependencies without approval where required.
12. Do not run destructive database, filesystem, Git, or deployment commands without explicit authorization.
13. Verify changes with the appropriate lint, typecheck, test, and build commands.
14. Report files changed, commands executed, observed results, unresolved issues, and decisions requiring approval.
15. If repository evidence conflicts with this document, explain the conflict instead of silently changing the architecture.

**Canonical rule:** Inspect first, follow the approved phase, preserve established decisions, protect secrets, and verify every claimed result.

_End of CHOVIA Technology Stack._

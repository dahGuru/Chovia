# CHOVIA — Monorepo Foundation & Workspace Architecture

This document describes the architectural foundation, workspace organization, tooling, and operational procedures for the CHOVIA food delivery platform monorepo.

---

## 1. Monorepo Organization

CHOVIA is structured as a **Modular Monolith Monorepo** managed with **pnpm workspaces** and **Turborepo 2**.

```text
Chovia/
├── apps/
│   ├── mobile/
│   │   ├── customer/            # @chovia/mobile-customer (React Native + Expo 58 + NativeWind)
│   │   └── rider/               # @chovia/mobile-rider (React Native + Expo 58 + NativeWind)
│   └── web/
│       ├── admin/               # @chovia/web-admin (Next.js 16 + React 19 + Tailwind v4)
│       ├── marketing/           # @chovia/web-marketing (Next.js 16 + React 19 + Tailwind v4)
│       └── restaurant/          # @chovia/web-restaurant (Next.js 16 + React 19 + Tailwind v4)
├── backend/                     # @chovia/backend (Fastify 5 + Prisma 7 + Zod 4)
├── database/
│   └── prisma/
│       ├── schema.prisma        # Canonical database schema (PostgreSQL + PostGIS)
│       ├── migrations/          # Version-controlled migrations directory
│       └── seed/                # Seed script directory
├── packages/
│   ├── config/                  # @chovia/config (Shared tsconfigs: base, node, nextjs, expo)
│   ├── types/                   # @chovia/types (Shared framework-agnostic domain primitives)
│   └── validation/              # @chovia/validation (Shared validation constraints & pure rules)
├── docs/                        # Architecture & foundation documentation
├── .node-version                # Pinned Node.js 24.22.3
├── package.json                 # Monorepo root manifest
├── pnpm-workspace.yaml          # pnpm workspace definition & engine permissions
├── turbo.json                   # Turborepo 2 task pipeline definition
├── eslint.config.js             # Flat ESLint 10 configuration
└── prettier.config.mjs          # Prettier formatting rules
```

---

## 2. Workspace Status & Package Responsibilities

| Package Name              | Path                    | Framework / Stack                                          | Role & Scope                                                                                              |
| ------------------------- | ----------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `@chovia/backend`         | `backend/`              | Fastify 5, Prisma 7, Zod 4, PostgreSQL                     | Authoritative backend API, business logic, DTO validation layer, and database access.                     |
| `@chovia/mobile-customer` | `apps/mobile/customer/` | Expo 58, React Native 0.88, Expo Router, NativeWind, Zod 3 | Customer mobile application for browsing menus, placing orders, and tracking deliveries.                  |
| `@chovia/mobile-rider`    | `apps/mobile/rider/`    | Expo 58, React Native 0.88, Expo Router, NativeWind, Zod 3 | Rider mobile application for delivery dispatch, route navigation, and earnings tracking.                  |
| `@chovia/web-admin`       | `apps/web/admin/`       | Next.js 16, React 19, Tailwind CSS v4, Zod 4               | Operations and platform administration web dashboard.                                                     |
| `@chovia/web-restaurant`  | `apps/web/restaurant/`  | Next.js 16, React 19, Tailwind CSS v4, Zod 4               | Restaurant vendor portal for menu management, order acceptance, and sales tracking.                       |
| `@chovia/web-marketing`   | `apps/web/marketing/`   | Next.js 16, React 19, Tailwind CSS v4, Zod 4               | Public-facing marketing website, onboarding landing pages, and customer acquisition.                      |
| `@chovia/config`          | `packages/config/`      | TypeScript Configs                                         | Shared TypeScript configurations (`base.json`, `node.json`, `nextjs.json`, `expo.json`).                  |
| `@chovia/types`           | `packages/types/`       | TypeScript                                                 | Pure, framework-agnostic primitive types (e.g. `JsonValue`, `JsonPrimitive`). Excludes raw Prisma models. |
| `@chovia/validation`      | `packages/validation/`  | TypeScript                                                 | Shared validation constraints, regex patterns, and pure validation functions bridging Zod 3 and Zod 4.    |

---

## 3. Tooling & Runtimes

- **Node.js**: `24.22.3` (pinned in `.node-version` and enforced via `engines` in root `package.json`).
- **Package Manager**: `pnpm` `12.6.0` (pinned via `packageManager` in root `package.json`).
- **Build Orchestration**: Turborepo `2.11.13`.
- **Database ORM**: Prisma `7.10.1` (`@prisma/client`, `@prisma/adapter-pg`, `pg`).
- **TypeScript**: `5.9.3` across all packages with strict type checking enabled.
- **Code Quality**: ESLint `10.15.0` (flat config) and Prettier `3.10.1`.
- **Unit Testing**: Vitest `5.1.1` configured with isolated `--no-cache` execution to prevent parallel file collisions on Windows.

---

## 4. Architectural Boundaries & Validation Strategy

### 4.1 Zod Version Separation

- **Backend & Web**: Uses **Zod 4** (`zod: ^4.6.7`) for Fastify DTO contracts, API serialization, and web dashboard form validation.
- **Mobile**: Uses **Zod 3** (`zod: ^3.25.76`) as required for Expo React Native ecosystem compatibility.
- **Shared Validation Layer (`@chovia/validation`)**: Provides zero-dependency domain constraints, regex constants (E.164 phone formats, email patterns, password complexity thresholds), and pure validator functions. Both Zod 3 schemas and Zod 4 schemas consume these constraints without causing runtime version mismatch.

### 4.2 DTO and Persistence Separation

- Raw Prisma model types are never exposed to API clients or frontend packages.
- The backend owns authoritative request and response DTO contracts.
- Frontend packages consume contract types derived from the API boundary.

---

## 5. Root Scripts & Operational Commands

All commands can be invoked from the monorepo root:

| Command             | Action                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------ |
| `pnpm dev`          | Starts all applications in development mode with Turborepo task watch.                     |
| `pnpm build`        | Builds all packages and applications following the Turborepo topological dependency graph. |
| `pnpm lint`         | Runs ESLint across all workspaces and source directories.                                  |
| `pnpm typecheck`    | Runs strict TypeScript type checking (`tsc --noEmit`) across all workspaces.               |
| `pnpm test`         | Runs the Vitest test suite across all packages (`--passWithNoTests --no-cache`).           |
| `pnpm clean`        | Cleans build artifacts (`dist/`, `.next/`, `.expo/`, `.turbo/`) across all packages.       |
| `pnpm format`       | Formats all files across the repository using Prettier.                                    |
| `pnpm format:check` | Verifies code formatting compliance without modifying files.                               |
| `pnpm db:validate`  | Validates `database/prisma/schema.prisma` using Prisma 7 CLI.                              |
| `pnpm db:format`    | Formats the Prisma schema file.                                                            |
| `pnpm db:generate`  | Generates Prisma Client 7.10.1 into `backend/src/generated/prisma`.                        |

### Running Individual Applications

- **Backend**: `pnpm --filter @chovia/backend dev`
- **Customer Mobile**: `pnpm --filter @chovia/mobile-customer dev`
- **Rider Mobile**: `pnpm --filter @chovia/mobile-rider dev`
- **Admin Web**: `pnpm --filter @chovia/web-admin dev`
- **Restaurant Web**: `pnpm --filter @chovia/web-restaurant dev`
- **Marketing Web**: `pnpm --filter @chovia/web-marketing dev`

---

## 6. Environment Variables

The monorepo foundation relies on the following environment variable names (values must remain local and confidential):

- `DATABASE_URL`: PostgreSQL connection string with PostGIS enabled (required for Prisma).
- `NODE_ENV`: Runtime environment (`development`, `test`, `production`).
- `PORT`: HTTP port for the backend API service (default `4000`).
- `HOST`: Network host binding for the backend API service (default `0.0.0.0`).

---

## 7. Next Recommended Development Stage

With the complete monorepo foundation, workspace pipelines, TypeScript configs, shared packages, and Prisma 7 schema validated and operational:

- **Stage 3 — Authentication & Security Core**:
  - Implement bcrypt password hashing service in backend.
  - Implement JWT token issue, verification, and rotation services.
  - Implement PostgreSQL-backed refresh token rotation with family revocation.
  - Implement DTO request schemas and response serializers for customer registration, login, and staff invitations.

# CHOVIA Integration Remediation, Rider Registration & KYC Completion Report

> **Workspace:** `C:\Users\HP\Videos\WEB DEV 1.0\Food Delivery\Chovia`
> **Node Version:** `v24.22.3`
> **Note on Migrations & Git:** No database migration was applied to any live database (`database/prisma/migrations/20261126200000_rider_kyc_and_availability/migration.sql` was generated unapplied), and no git staging, commits, pushes, or reverts were executed.

---

## 1. What Was Inspected

Before modifying code, the repository was inspected across:
- Root governance & docs: `AGENTS.md`, `TECH-STACK.md`, `ENVIRONMENT.md`, `package.json`, `pnpm-lock.yaml`, `api/openapi/openapi.json`, `api/openapi/openapi.yaml`.
- Database schema & migrations: `database/prisma/schema.prisma`, `database/prisma/migrations/*`.
- Backend modules & security infrastructure: `backend/.env.example`, `backend/src/config/env.ts`, `backend/src/app.ts`, `backend/src/cache/redis.ts`, `backend/src/database/prisma.ts`, `backend/src/integrations/cloudinary/cloudinary.service.ts`, `backend/src/integrations/email/email.service.ts`, `backend/src/integrations/sentry/sentry.service.ts`, `backend/src/modules/auth/*`, `backend/src/modules/users/*`, `backend/src/modules/orders/*`, `backend/src/modules/delivery/*`, `backend/src/modules/admin/*`, `backend/scripts/generate-openapi.ts`, and `backend/src/tests/*`.
- Shared validation package: `packages/validation/src/index.ts`, `packages/validation/src/index.test.ts`.
- Customer & Rider mobile apps: `.env.example`, `app.json`, `package.json`, `utils/env.ts`, `utils/validation.ts`, `services/api.ts`, `services/authService.ts`, `services/orderService.ts`, `services/riderAccountService.ts`, `services/riderDeliveryService.ts`, `hooks/*`, `store/*`, Customer `(auth)/register.tsx`, `profile/edit.tsx`, `(tabs)/orders.tsx`, and Rider `(auth)/*`, `(tabs)/*`, `deliveries/[id].tsx`, `settings/index.tsx`.

---

## 2. Root Causes & Findings

1. **Physical-Device Environment Resolution:** Both mobile apps fell back to `http://localhost:4000/api/v1` / `10.0.2.2` regardless of `Constants.isDevice`, causing silent network failures on physical phones when `EXPO_PUBLIC_API_URL` was missing.
2. **Nigerian Phone Format Rejection:** Customer `register.tsx` and `profile/edit.tsx` enforced raw E.164 regex (`+234...`), rejecting standard local Nigerian inputs like `08054093095`.
3. **Missing Rider Self-Registration & KYC Flow:** Backend `/auth/register` only registered `CUSTOMER` accounts; there was no rider registration endpoint, no persistent Rider KYC / document model, no encrypted storage for government IDs / bank numbers, and no admin KYC approval/rejection workflow. Rider `app/(auth)/kyc.tsx` was local draft only.
4. **Public Cloudinary Document Storage & Ownership Gap:** `cloudinary.service.ts` used default public `"upload"` delivery URLs for `"documents"` and only checked user ownership (`verifyAssetWithProvider`) for `"avatars"`, omitting `"documents"`.
5. **`PATCH /riders/status` Lifecycle Bug & Hardcoded GPS:** `deliveryService.updateRiderStatus` mutated `RiderProfile.status` (`ACTIVE`/`DEACTIVATED`) instead of `isOnline`/`isAvailable` and ignored GPS coordinates, while Rider `(tabs)/index.tsx` sent hardcoded coordinates `(6.7429, 6.1356)` and `app/settings/index.tsx` sent `status: "DEACTIVATED"`.
6. **Orders Contract Mismatch & Resource-Level Authorization Gaps:**
   - `orders.routes.ts` declared `200: z.array(orderResponseSchema)` while `ordersService.list` returned `{ items, total, page, limit, totalPages }`.
   - `ordersService.list` lacked `RIDER` scoping and allowed `RESTAURANT_STAFF` to supply an arbitrary `query.restaurantId` without membership verification.
   - `ordersService.getById` lacked `RIDER` and `RESTAURANT_STAFF` resource checks.
   - `ordersService.cancelOrder` never verified `order.customerId` ownership or `userRole`.
   - `deliveryService.trackDelivery` never checked caller ownership/role (`CUSTOMER`, `RIDER`, `RESTAURANT_STAFF`, `ADMIN`).
7. **Missing Rider Session Recovery & Delivery History:** Rider `(tabs)/deliveries.tsx` and `(tabs)/earnings.tsx` relied on transient session-only Zustand arrays with no server endpoints for `/riders/me`, `/riders/deliveries/active`, or `/riders/deliveries/history`.

---

## 3. Changes Implemented

### Environment & Connectivity
- Updated `apps/mobile/customer/utils/env.ts` and `apps/mobile/rider/utils/env.ts` with `resolveApiBaseUrl()` using `expo-constants` (`Constants.isDevice`) and `Platform.OS`: resolves Android emulator (`http://10.0.2.2:4000/api/v1`), iOS simulator/Web (`http://localhost:4000/api/v1`), validates `EXPO_PUBLIC_API_URL`, and throws/surfaces `ENV.configError` on physical devices when `EXPO_PUBLIC_API_URL` is missing (without hardcoding any local LAN IP).
- Surfaced `ENV.configError` in `apps/mobile/*/app/_layout.tsx` and rejected requests cleanly in `apps/mobile/*/services/api.ts` (`ENV_CONFIGURATION_ERROR`).
- Updated `apps/mobile/customer/.env.example`, `apps/mobile/rider/.env.example`, `backend/.env.example`, `backend/src/config/env.ts` (added `KYC_ENCRYPTION_KEY` validated as 64-char hex / 32 bytes, mandatory in `production`/`staging`, dev fallback in dev/test, and Expo Web dev origins in `CORS_ORIGIN`), and `ENVIRONMENT.md` (documenting startup sequence and real credential requirements).

### Phone Normalization
- Added framework-agnostic `normalizeNigerianPhone` in `packages/validation/src/index.ts`, `apps/mobile/customer/utils/validation.ts`, and `apps/mobile/rider/utils/validation.ts` (`08054093095` → `+2348054093095`, `2348054093095` → `+2348054093095`, valid international E.164 preserved, `+2340...` and malformed inputs rejected).
- Integrated `normalizeNigerianPhone` into Customer `register.tsx`, Customer `profile/edit.tsx`, Rider `register.tsx`, and Rider `kyc.tsx`. Kept strict E.164 validation (`^\+[1-9]\d{7,14}$`) on backend DTOs (`auth.dto.ts`, `kyc.dto.ts`).

### Encryption, Private Cloudinary Storage & Sentry Scrubbing
- Created `backend/src/utils/encryption.ts` implementing AES-256-GCM authenticated encryption (`encryptSensitiveValue`, `decryptSensitiveValue`, `parseEncryptionKey`, `maskSensitiveDigits`).
- Updated `backend/src/integrations/sentry/sentry.service.ts` to scrub KYC sensitive keys (`governmentidnumber`, `nationalidnumber`, `bankaccountnumber`, `kycencryptionkey`).
- Updated `backend/src/integrations/cloudinary/cloudinary.service.ts`, `backend/src/modules/users/users.routes.ts`, and `backend/src/modules/users/dto/user.dto.ts`:
  - `documents` category now uses `deliveryType: "authenticated"` (signed private uploads and short-lived HMAC-signed `private_download_url` access links generated on demand via `generateSignedAssetUrl`).
  - `verifyAssetWithProvider` enforces segment-exact user ownership on both `avatars` and `documents`, checks `type === "authenticated"`, and supports both `image` and `raw` (PDF) lookups for `auto` policy resources.
  - `users.routes.ts` scopes `documents` and `avatars` upload signatures and direct server uploads under the authenticated user's `userId` prefix.

### Prisma Schema & Migration (Unapplied)
- Updated `database/prisma/schema.prisma`:
  - Added `RiderKycStatus` (`PENDING`, `UNDER_REVIEW`, `APPROVED`, `REJECTED`) and `RiderDocumentType` (`GOVERNMENT_ID`, `DRIVER_LICENSE`, `VEHICLE_REGISTRATION`, `SELFIE`).
  - Updated `RiderProfile` (`isAvailable @default(false)`, `operatingCity`, `kycApplication` relation).
  - Added `RiderKycApplication` (`encryptedGovernmentId`, `governmentIdMasked`, `encryptedBankAccountNumber`, `bankAccountMasked`, vehicle/city/payout details, review fields) and `RiderDocument` (`publicId`, `resourceType`, `deliveryType`, no permanent public URL).
- Generated unapplied migration `database/prisma/migrations/20261126200000_rider_kyc_and_availability/migration.sql` and ran `pnpm db:validate` + `pnpm db:generate`.

### Backend Rider Registration, KYC, Admin Review, Availability/GPS, Session Recovery & Authorization
- **Auth (`backend/src/modules/auth/*`):** Added `POST /api/v1/auth/rider/register` creating `User` (`role: "RIDER"`, `status: "ACTIVE"`, `emailVerified: false`) and `RiderProfile` (`status: "PENDING"`, `isOnline: false`, `isAvailable: false`), sending email OTP with graceful retryable failure handling (`emailDeliveryStatus: "FAILED_RETRYABLE"`).
- **Rider KYC & Delivery (`backend/src/modules/delivery/*`):**
  - Created `dto/kyc.dto.ts` and `rider-kyc.service.ts` backing `POST /api/v1/riders/kyc` and `GET /api/v1/riders/kyc`.
  - Fixed `PATCH /api/v1/riders/status`: going online checks `status === "ACTIVE"`, requires valid `latitude`/`longitude`, updates `lastLatitude`, `lastLongitude`, `lastLocationUpdatedAt`, sets `isOnline = true`, and sets `isAvailable = true` only when no active delivery exists; going offline sets `isOnline = false`, `isAvailable = false` while preserving `RiderProfile.status`.
  - Added `PATCH /api/v1/riders/location`, `GET /api/v1/riders/me`, `GET /api/v1/riders/deliveries/active`, and `GET /api/v1/riders/deliveries/history`.
  - Updated `getAvailableDeliveries` to enforce `rider.status === "ACTIVE"`, and `completeDelivery` to avoid restoring `isAvailable = true` when offline or inactive.
- **Admin KYC Review (`backend/src/modules/admin/*`):**
  - Added `ADMIN`-protected `GET /api/v1/admin/riders/applications`, `GET /api/v1/admin/riders/applications/:id`, `POST /api/v1/admin/riders/applications/:id/approve`, and `POST /api/v1/admin/riders/applications/:id/reject` with atomic `AuditLog` + `Notification` creation; updated `adminService.updateRiderStatus` to clear `isOnline` / `isAvailable` when a rider is not `ACTIVE`.
- **Orders & Tracking Authorization (`backend/src/modules/orders/*`, `delivery.service.ts`, `delivery.routes.ts`):**
  - Fixed `GET /orders` OpenAPI/Fastify response schema to `paginatedOrdersResponseSchema` (`{ items, total, page, limit, totalPages }`).
  - Added role-scoped `list()` filtering for `RIDER` and strict `RESTAURANT_STAFF` membership checks, plus resource ownership/role checks on `GET /orders/:id`, `POST /orders/:id/cancel`, and `GET /deliveries/:orderId/track`.
  - Regenerated `api/openapi/openapi.json` and `api/openapi/openapi.yaml`.

### Mobile Customer & Rider Apps
- **Customer (`apps/mobile/customer`):** Aligned `services/orderService.ts` (`PaginatedOrdersResponseDto`, `listPaginated`, `list`), added Nigerian phone normalization to `register.tsx` & `profile/edit.tsx`, and updated `utils/env.ts` + `_layout.tsx`.
- **Rider (`apps/mobile/rider`):**
  - Installed Expo 58-compatible `expo-location` (`~58.0.22`), `expo-document-picker` (`~58.0.5`), and `expo-file-system` (`~58.0.14`); updated `app.json`.
  - Added `services/locationService.ts` (`expo-location` foreground permission & GPS coordinates), `app/(auth)/register.tsx`, and `app/(auth)/application-status.tsx`.
  - Upgraded `app/(auth)/onboarding.tsx`, `otp.tsx` (dual-mode email verification + resend + password reset), `login.tsx` (post-login routing to dashboard vs KYC vs application status), and `kyc.tsx` (real 4-step KYC + private Cloudinary document upload).
  - Upgraded `(tabs)/index.tsx`, `(tabs)/deliveries.tsx`, `(tabs)/earnings.tsx`, `(tabs)/profile.tsx`, `app/deliveries/[id].tsx`, `app/settings/index.tsx`, `hooks/useRiderQueries.ts`, and `store/useRiderStore.ts` to recover authoritative profile/online/active-delivery/history state from backend APIs and capture/sync real GPS coordinates.

---

## 4. Files Created & Modified (Task Scope)

**Created:**
- `backend/src/utils/encryption.ts`
- `backend/src/modules/delivery/dto/kyc.dto.ts`
- `backend/src/modules/delivery/rider-kyc.service.ts`
- `backend/src/tests/encryption.test.ts`
- `backend/src/tests/remediation.test.ts`
- `database/prisma/migrations/20261126200000_rider_kyc_and_availability/migration.sql`
- `apps/mobile/rider/services/locationService.ts`
- `apps/mobile/rider/app/(auth)/register.tsx`
- `apps/mobile/rider/app/(auth)/application-status.tsx`
- `apps/mobile/customer/utils/envAndValidation.test.ts`
- `apps/mobile/rider/utils/envAndValidation.test.ts`
- `docs/integration-remediation-completion-report.md`

**Modified:**
- `ENVIRONMENT.md`, `backend/.env.example`, `apps/mobile/customer/.env.example`, `apps/mobile/rider/.env.example`, `pnpm-lock.yaml`
- `packages/validation/src/index.ts`, `packages/validation/src/index.test.ts`
- `database/prisma/schema.prisma`
- `api/openapi/openapi.json`, `api/openapi/openapi.yaml`
- `backend/src/config/env.ts`, `backend/src/integrations/cloudinary/cloudinary.service.ts`, `backend/src/integrations/sentry/sentry.service.ts`
- `backend/src/modules/auth/dto/auth.dto.ts`, `backend/src/modules/auth/auth.service.ts`, `backend/src/modules/auth/auth.routes.ts`
- `backend/src/modules/users/dto/user.dto.ts`, `backend/src/modules/users/users.routes.ts`
- `backend/src/modules/delivery/dto/delivery.dto.ts`, `backend/src/modules/delivery/dto/index.ts`, `backend/src/modules/delivery/delivery.service.ts`, `backend/src/modules/delivery/delivery.routes.ts`
- `backend/src/modules/admin/admin.routes.ts`, `backend/src/modules/admin/admin.service.ts`
- `backend/src/modules/orders/dto/order.dto.ts`, `backend/src/modules/orders/orders.routes.ts`, `backend/src/modules/orders/orders.service.ts`
- `backend/src/tests/integrations-security.test.ts`, `backend/src/tests/openapi.test.ts`
- `apps/mobile/customer/utils/env.ts`, `apps/mobile/customer/utils/validation.ts`, `apps/mobile/customer/services/api.ts`, `apps/mobile/customer/services/orderService.ts`, `apps/mobile/customer/app/_layout.tsx`, `apps/mobile/customer/app/(auth)/register.tsx`, `apps/mobile/customer/app/profile/edit.tsx`, `apps/mobile/customer/store/useAuthStore.test.ts`
- `apps/mobile/rider/package.json`, `apps/mobile/rider/app.json`, `apps/mobile/rider/utils/env.ts`, `apps/mobile/rider/utils/validation.ts`, `apps/mobile/rider/services/api.ts`, `apps/mobile/rider/services/authService.ts`, `apps/mobile/rider/services/riderDeliveryService.ts`, `apps/mobile/rider/hooks/useRiderQueries.ts`, `apps/mobile/rider/store/useRiderStore.ts`, `apps/mobile/rider/store/useAuthStore.ts`, `apps/mobile/rider/store/useAuthStore.test.ts`, `apps/mobile/rider/app/_layout.tsx`, `apps/mobile/rider/app/(auth)/onboarding.tsx`, `apps/mobile/rider/app/(auth)/login.tsx`, `apps/mobile/rider/app/(auth)/otp.tsx`, `apps/mobile/rider/app/(auth)/kyc.tsx`, `apps/mobile/rider/app/(tabs)/index.tsx`, `apps/mobile/rider/app/(tabs)/deliveries.tsx`, `apps/mobile/rider/app/(tabs)/earnings.tsx`, `apps/mobile/rider/app/(tabs)/profile.tsx`, `apps/mobile/rider/app/deliveries/[id].tsx`, `apps/mobile/rider/app/settings/index.tsx`

---

## 5. Dependencies Changed

- Added to `apps/mobile/rider/package.json` (Expo SDK 58 pinned ranges):
  - `expo-location`: `~58.0.22`
  - `expo-document-picker`: `~58.0.5`
  - `expo-file-system`: `~58.0.14`
- Updated `pnpm-lock.yaml` accordingly. No dependencies added/changed in backend or customer mobile.

---

## 6. Verification Commands & Observed Results

- `pnpm db:validate`: Passed (`The schema at database\prisma\schema.prisma is valid`).
- `pnpm db:generate`: Passed (Prisma Client `7.10.1` generated to `backend/src/generated/prisma`).
- `pnpm --filter @chovia/validation build` & `test`: Passed (`5 passed (5)` in `src/index.test.ts`).
- `pnpm --filter @chovia/backend typecheck`: Passed (0 errors).
- `pnpm --filter @chovia/backend lint`: Passed (0 errors).
- `pnpm --filter @chovia/backend openapi:generate`: Passed (wrote `api/openapi/openapi.json` 336,238 bytes and `api/openapi/openapi.yaml` 242,178 bytes).
- `pnpm --filter @chovia/backend build`: Passed (`tsc -p tsconfig.json`, 0 errors).
- `pnpm --filter @chovia/backend test`:
  - `8 of 9` test files passed (`144 passed`, `0 skipped`, `1` pre-existing failure in `queues-workflows.test.ts > Expo Push Service & Token Maintenance > should poll and reconcile receipts for submitted notification deliveries older than 15 minutes` due to `receiptId` mismatch in the pre-existing push receipt reconciliation test).
  - Baseline comparison: improved from `111 passed`, `1 failed`, `16 skipped` to `144 passed`, `1 pre-existing failed`, `0 skipped` (including `encryption.test.ts` 5/5, `remediation.test.ts` 11/11, `integrations-security.test.ts` 32/32, `app.test.ts` 7/7, `openapi.test.ts` passed).
- `pnpm --filter @chovia/mobile-customer typecheck` & `lint`: Passed (0 errors).
- `pnpm --filter @chovia/mobile-customer test`: Passed (`2 files`, `6 passed (6)`).
- `pnpm --filter @chovia/mobile-customer build` (`expo export --platform all`): Passed (Web, iOS, Android exported to `dist`).
- `pnpm --filter @chovia/mobile-rider typecheck` & `lint`: Passed (0 errors).
- `pnpm --filter @chovia/mobile-rider test`: Passed (`2 files`, `6 passed (6)`).
- `pnpm --filter @chovia/mobile-rider build` (`expo export --platform all`): Passed (Web, iOS, Android exported to `dist`).

---

## 7. Not Executed / Remaining Risks & Decisions

1. **Migration Not Applied:** `database/prisma/migrations/20261126200000_rider_kyc_and_availability/migration.sql` has not been applied to a live PostgreSQL instance (`prisma migrate deploy` must be executed by the operator against the target database when ready).
2. **Live External Integrations & Device Testing:**
   - Backend integration tests ran with mocked Prisma and mocked Cloudinary/Resend in Vitest rather than a live PostgreSQL, Redis, Cloudinary, Resend, or Paystack sandbox session.
   - Physical-device Expo Go / development-build runtime tests (`expo-location` GPS hardware permission prompts, `expo-document-picker` native file chooser, LAN IP connectivity against running backend + worker) were not executed on physical iOS/Android hardware in this environment.
3. **Pre-Existing Queue Test Failure:** `backend/src/tests/queues-workflows.test.ts` > `"should poll and reconcile receipts for submitted notification deliveries older than 15 minutes"` was already failing before remediation (`receiptId` field assertion vs `prisma.notificationDelivery.update`) and was preserved untouched as out of scope.
4. **Operational Requirement Before Deployment:** Production and staging deployments must supply a distinct 64-character hexadecimal `KYC_ENCRYPTION_KEY` in secrets management; the backend rejects startup if `KYC_ENCRYPTION_KEY` is missing or left on the development default.

# CHOVIA — Backend Third-Party Integrations

> **Document:** External Services Integration Architecture, Clients, and Mock Mode  
> **Status:** Implemented MVP (Automated tests pass; requires staging verification for live external endpoints)  
> **Integrations Directory:** [backend/src/integrations](file:///C:/Users/HP/Videos/WEB DEV 1.0/Food Delivery/Chovia/backend/src/integrations)  

---

## 1. Integrations Overview

CHOVIA integrates with external third-party service providers to power payments, geocoding, media asset uploads, transactional messaging, and observability. All integrations are abstracted through dedicated service classes that support an automated **Mock Mode** in local development and unit testing when `MOCK_INTEGRATIONS=true`, while strictly forbidding mock mode in staging and production.

| Provider | Purpose | Production Implementation | Local / Test Mock Behavior |
|---|---|---|---|
| **Paystack** | Payment Processing & Refunds | REST API + HMAC-SHA512 Webhooks + Refunds | Generates simulated authorization URLs, instant verification, and mock refunds |
| **Google Maps** | Routes API & Geocoding | Google Maps Platform Routes API | Mock routes / Haversine fallback (forbidden in staging/production) |
| **Cloudinary** | Media Upload Management | Direct Signed Uploads + Magic Bytes Validation | Generates deterministic signatures and mocks upload verification |
| **Resend** | Transactional Emails | Resend HTTPS API Client | Logs email templates or resolves mock identifiers without network call |
| **Expo Push** | Mobile Notifications | Expo Push API (`https://exp.host/--/api/v2/push/send`) | Generates mock ticket IDs and deactivates dead tokens |
| **Sentry** | Observability & APM | Sentry Node SDK with Deep PII/Secret Scrubbing | Disabled or dry-run without active DSN |
| **Redis / BullMQ** | Caching & Background Queues | Redis 7 + BullMQ Queues | In-memory cache fallback and lazy queue execution |

---

## 2. Paystack Payment & Refund Integration

Location: [backend/src/integrations/paystack/paystack.service.ts](file:///C:/Users/HP/Videos/WEB DEV 1.0/Food Delivery/Chovia/backend/src/integrations/paystack/paystack.service.ts), [backend/src/modules/payments/payments.service.ts](file:///C:/Users/HP/Videos/WEB DEV 1.0/Food Delivery/Chovia/backend/src/modules/payments/payments.service.ts)

### Capabilities
- **Row-Level Exclusive Locking (`FOR UPDATE`):** Acquires PostgreSQL row-level locks on `orders` during refund reservation and payment state updates, eliminating race conditions under concurrent refund or checkout attempts.
- **Concurrency-Safe Partial Refunds:** Computes cumulative existing non-failed refunds against total captured payment amount. Rejects requests exceeding remaining refundable balance.
- **Monotonic Refund State Machine:** Enforces transitions `REFUND_PENDING` -> `PROCESSING` -> `REFUNDED` (terminal success) or `FAILED` (terminal failure). Webhook late arrivals cannot downgrade a confirmed `REFUNDED` status to `FAILED`.
- **Provider Timeout Recovery:** On Paystack gateway timeout (502 `PaymentGatewayError`), the database reservation is safely preserved in `PROCESSING` status rather than releasing funds prematurely or failing silently.
- **Unambiguous Webhook Correlation & Quarantine:** Matches incoming refund webhooks by `providerRefundId` first. If matching by order payment reference, correlates only when exactly one candidate exists; ambiguous multi-refund orders are quarantined for manual operator review without state corruption.
- **Strict Webhook Quarantine on Mismatch:** Quarantines webhooks with missing amount, currency, or mismatched figures without falsely marking successful customer payments as failed.
- **Reconciliation Endpoints:** Exposes `reconcilePayment(paymentId)` and `reconcileRefund(refundId)` for administrative operational verification and automated recovery.

---

## 3. Google Maps Platform Integration

Location: [backend/src/integrations/google-maps/google-maps.service.ts](file:///C:/Users/HP/Videos/WEB DEV 1.0/Food Delivery/Chovia/backend/src/integrations/google-maps/google-maps.service.ts)

### Capabilities
- **Address Geocoding:** Converts text addresses into latitude and longitude coordinates.
- **Motorcycle Route Calculation:** Queries Google Routes API for two-wheeler / motorcycle routes between restaurants and delivery destinations.
- **Strict Environment Policy:** In staging and production, mock mode and silent Haversine fallbacks are strictly prohibited; missing keys or API errors throw `PaymentGatewayError` or `ApiError` to alert operations.

---

## 4. Cloudinary Media Management

Location: [backend/src/integrations/cloudinary/cloudinary.service.ts](file:///C:/Users/HP/Videos/WEB DEV 1.0/Food Delivery/Chovia/backend/src/integrations/cloudinary/cloudinary.service.ts)

### Capabilities
- **Async DNS Resolution & SSRF Prevention (`validateRemoteUrl`):** Enforces HTTPS and performs asynchronous DNS lookups (`dns.promises.lookup` with `{ all: true }`) resolving all IPv4 and IPv6 addresses. Blocks domains resolving to loopback (`127.0.0.0/8`, `::1`), private (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), link-local/cloud metadata (`169.254.0.0/16`, `fe80::/10`), carrier-grade NAT (`100.64.0.0/10`), unique local (`fc00::/7`), and documentation/test net ranges.
- **Exact Segment-Based Asset Ownership:** Enforces exact path segment matching for user avatars (`chovia/avatars/{userId}/...` or `chovia/avatars/{userId}_...`), preventing substring collision vulnerabilities (e.g. `user_1` claiming `user_100` assets).
- **Signed Client Uploads:** Generates cryptographic HMAC-SHA1 signatures with signed folder, timestamp, and size parameters, allowing mobile/web apps to upload directly to Cloudinary without streaming binary files through API servers.
- **Magic Byte Sniffing (`inspectFileMagicBytes`):** Validates buffer magic bytes (JPEG `FF D8 FF`, PNG `89 50 4E 47`, WEBP `RIFF...WEBP`, PDF `%PDF`) before processing or storing images.
- **Post-Upload Verification (`/verify-upload`):** Validates that uploaded assets match folder policies, format restrictions, and byte size limits before attaching them to domain entities.
- **Supported Storage Categories:**
  - `avatars`: User and rider profile photos (5MB limit, images only).
  - `menu`: Menu item photos and dish previews (5MB limit, images only).
  - `restaurants`: Restaurant logo images and cover banners (5MB limit, images only).
  - `documents`: Rider driver licenses, vehicle registration, and identity documents (10MB limit, images + PDF).

---

## 5. Resend Transactional Email Service

Location: [backend/src/integrations/resend/resend.service.ts](file:///C:/Users/HP/Videos/WEB DEV 1.0/Food Delivery/Chovia/backend/src/integrations/resend/resend.service.ts)

### Capabilities
- **Account Verification Email:** Dispatches 6-digit OTP code for email address verification.
- **Password Reset Email:** Dispatches 6-digit OTP code for password recovery.
- **Staff Invitation Email:** Dispatches cryptographic invite link allowing prospective staff members to join a restaurant team.
- **Queueing & Fallback:** Enqueued via BullMQ with SHA-256 opaque job IDs, with automatic direct-dispatch fallback if queues are unavailable.

---

## 6. Expo Push Notification Service & Durable Receipts

Location: [backend/src/integrations/expo/expo-push.service.ts](file:///C:/Users/HP/Videos/WEB DEV 1.0/Food Delivery/Chovia/backend/src/integrations/expo/expo-push.service.ts), [backend/src/jobs/processors/notification.processor.ts](file:///C:/Users/HP/Videos/WEB DEV 1.0/Food Delivery/Chovia/backend/src/jobs/processors/notification.processor.ts)

### Capabilities
- **Durable Delivery Lifecycle:** Tracks individual device deliveries via `NotificationDelivery` (`QUEUED` -> `SUBMITTED` -> `DELIVERED` / `FAILED`).
- **Push Notification Dispatch:** Formats and batches push messages to Expo's push service endpoint (`https://exp.host/--/api/v2/push/send`) with mandatory `EXPO_ACCESS_TOKEN` bearer authentication in staging and production.
- **Recurring Receipt Reconciliation Worker:** Runs a continuous background polling loop (`pollAndReconcileReceipts`) querying Expo receipts for notifications submitted >15 minutes ago, marking confirmed deliveries as `DELIVERED`, capturing provider failure reasons, and updating PostgreSQL state.
- **Automated Token Maintenance:** Automatically catches `DeviceNotRegistered` error tickets and receipts, deactivating expired device tokens (`UserDevice.isActive = false`) in PostgreSQL.

---

## 7. Sentry Observability & PII Sanitization

Location: [backend/src/integrations/sentry/sentry.service.ts](file:///C:/Users/HP/Videos/WEB DEV 1.0/Food Delivery/Chovia/backend/src/integrations/sentry/sentry.service.ts)

### Capabilities
- **Exception & Breadcrumb Capture:** Captures runtime exceptions, HTTP request context, and distributed traces without mutating original `Error` objects.
- **Bounded Recursion & Circular Reference Protection:** `scrubData` utilizes a `WeakSet<object>` visited tracker to detect circular references (`[CIRCULAR]`) and bounds nested structure traversal to a depth of 10 (`[MAX_DEPTH_EXCEEDED]`), preventing call stack exhaustion.
- **Deep PII/Secret Scrubbing:** Pure, non-mutating masking across all event surfaces (headers, body data, query strings, breadcrumbs, user info, tags, contexts, and exception messages) for Bearer tokens, JWTs, connection URLs, Paystack keys, passwords, OTPs, CVVs, and account numbers.

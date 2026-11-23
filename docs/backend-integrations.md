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

Location: [backend/src/integrations/paystack/paystack.service.ts](file:///C:/Users/HP/Videos/WEB DEV 1.0/Food Delivery/Chovia/backend/src/integrations/paystack/paystack.service.ts)

### Capabilities
- **Transaction Initialization:** Sends payment amount (in kobo minor units), customer email, order reference, and callback URL to Paystack. Enforces strict provider reference verification (`data.reference === params.reference`).
- **Payment Verification:** Queries `/transaction/verify/:reference` with expected amount and currency checks. Distinguishes transient provider 5xx outages (throws `PaymentGatewayError`) from genuine failures.
- **HMAC Webhook Ingestion:** Validates incoming `x-paystack-signature` using HMAC-SHA512 with `PAYSTACK_WEBHOOK_SECRET`. Handles `charge.success`, `refund.processed`, and `refund.failed`.
- **Refund Management:** Initiates refunds via Paystack `/refund` API (`createRefund`), records merchant notes, updates refund records, and creates audit logs.
- **State Reconciliation:** Prevents reviving terminal order states (`CANCELLED`, `REJECTED`) or orders with existing refunds to `CONFIRMED`.

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

## 6. Expo Push Notification Service

Location: [backend/src/integrations/expo/expo-push.service.ts](file:///C:/Users/HP/Videos/WEB DEV 1.0/Food Delivery/Chovia/backend/src/integrations/expo/expo-push.service.ts)

### Capabilities
- **Push Notification Dispatch:** Formats and batches push messages to Expo's push service endpoint (`https://exp.host/--/api/v2/push/send`) with optional `EXPO_ACCESS_TOKEN` bearer authentication.
- **Token Validation (`isExpoPushToken`):** Validates token format before network dispatch.
- **Token Maintenance:** Automatically catches `DeviceNotRegistered` error tickets and deactivates expired tokens (`UserDevice.isActive = false`) in PostgreSQL.

---

## 7. Sentry Observability & PII Sanitization

Location: [backend/src/integrations/sentry/sentry.service.ts](file:///C:/Users/HP/Videos/WEB DEV 1.0/Food Delivery/Chovia/backend/src/integrations/sentry/sentry.service.ts)

### Capabilities
- **Exception & Breadcrumb Capture:** Captures runtime exceptions, HTTP request context, and distributed traces.
- **Deep PII Scrubbing (`scrubData` & `sanitizeString`):** Masks Bearer tokens, JWT strings, connection URLs with credentials, Paystack keys, Resend keys, passwords, OTPs, CVVs, and account numbers from strings, request headers, query parameters, breadcrumbs, tags, and exceptions.

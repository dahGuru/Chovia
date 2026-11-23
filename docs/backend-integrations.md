# CHOVIA — Backend Third-Party Integrations

> **Document:** External Services Integration Architecture, Clients, and Mock Mode  
> **Status:** Production-Ready MVP Implementation  
> **Integrations Directory:** [backend/src/integrations](file:///C:/Users/HP/Videos/WEB DEV 1.0/Food Delivery/Chovia/backend/src/integrations)  

---

## 1. Integrations Overview

CHOVIA integrates with several external third-party service providers to power payments, geocoding, asset storage, and transactional messaging. All integrations are abstracted through dedicated service classes that support an automated **Mock Mode** when `MOCK_INTEGRATIONS=true` or when running outside production.

| Provider | Purpose | Production Implementation | Local / Test Mock Behavior |
|---|---|---|---|
| **Paystack** | Payment Processing | REST API + HMAC-SHA512 Webhook | Generates simulated authorization URLs and instant verification responses |
| **Google Maps** | Geocoding & Distance Matrix | Google Maps Platform APIs | Automatic fallback to Haversine geospatial calculations |
| **Cloudflare R2 / S3** | Image & Document Storage | AWS S3 SDK Presigned URLs | Generates deterministic mock upload and public URLs |
| **Email Service** | Transactional Emails | SMTP / Resend API | Logs formatted email templates to console without network transmission |
| **Redis / BullMQ** | Caching & Background Jobs | Redis 7 + BullMQ Queues | In-memory cache fallback and lazy queue execution |

---

## 2. Paystack Payment Integration

Location: [backend/src/integrations/paystack/paystack.service.ts](file:///C:/Users/HP/Videos/WEB DEV 1.0/Food Delivery/Chovia/backend/src/integrations/paystack/paystack.service.ts)

### Capabilities
- **Transaction Initialization:** Sends payment amount (in kobo minor units), customer email, order reference, and callback URL to Paystack. Returns `authorization_url` and `access_code`.
- **Payment Verification:** Queries `/transaction/verify/:reference` to verify transaction status (`success`), currency, and paid amount.
- **Webhook Ingestion:** Validates incoming `x-paystack-signature` using HMAC-SHA512 with `PAYSTACK_WEBHOOK_SECRET`. Idempotently updates order status to `CONFIRMED` upon `charge.success`.

---

## 3. Google Maps & Geocoding Integration

Location: [backend/src/integrations/google-maps/maps.service.ts](file:///C:/Users/HP/Videos/WEB DEV 1.0/Food Delivery/Chovia/backend/src/integrations/google-maps/maps.service.ts)

### Capabilities
- **Address Geocoding:** Converts text addresses into latitude and longitude coordinates. In mock mode, returns geographic coordinates centered around Abuja/Lagos.
- **Distance Matrix Calculation:** Computes road travel distance (in kilometers) and estimated travel duration (in minutes) between restaurant coordinates and customer delivery address.
- **Haversine Algorithmic Fallback:** When Google Maps API key is omitted or the service is offline, the backend automatically invokes [src/utils/geo.ts](file:///C:/Users/HP/Videos/WEB DEV 1.0/Food Delivery/Chovia/backend/src/utils/geo.ts) to compute great-circle distance with speed estimations (25 km/h for urban delivery riders).

---

## 4. Asset Storage Integration (Cloudflare R2 / S3)

Location: [backend/src/integrations/storage/storage.service.ts](file:///C:/Users/HP/Videos/WEB DEV 1.0/Food Delivery/Chovia/backend/src/integrations/storage/storage.service.ts)

### Capabilities
- **Presigned Upload URLs:** Generates time-limited HTTP `PUT` URLs allowing client applications (mobile and web) to upload photos directly to object storage without routing large binary files through the Fastify API server.
- **Supported Storage Folders:**
  - `menu`: Menu item photos and dish previews.
  - `restaurants`: Restaurant logo images and cover banners.
  - `avatars`: User and rider profile profile pictures.
  - `documents`: Rider driver licenses, vehicle registration, and identity documents.

---

## 5. Transactional Email Service

Location: [backend/src/integrations/email/email.service.ts](file:///C:/Users/HP/Videos/WEB DEV 1.0/Food Delivery/Chovia/backend/src/integrations/email/email.service.ts)

### Capabilities
- **Account Verification Email:** Dispatches 6-digit OTP code for email address verification.
- **Password Reset Email:** Dispatches 6-digit OTP code for password recovery.
- **Staff Invitation Email:** Dispatches cryptographic invite link allowing prospective staff members to join a restaurant team.
- **Safe Development Fallback:** In non-production environments, emails are simulated, ensuring automated tests and local development run without SMTP dependencies.

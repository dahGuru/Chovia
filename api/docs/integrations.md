# CHOVIA — Third-Party Integrations Reference

> **Specification:** Cloudinary, Resend, Sentry, Google Maps, Redis, and BullMQ

## 1. Cloudinary
- **Package:** `cloudinary` (v2)
- **Configuration:** `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- **Features:** Direct upload signatures, server upload, asset deletion, MIME type validation.

## 2. Resend
- **Package:** `resend`
- **Configuration:** `RESEND_API_KEY`, `EMAIL_FROM`
- **Features:** Transactional email delivery for verification OTPs, password reset codes, and restaurant staff invitations.

## 3. Sentry
- **Package:** `@sentry/node`
- **Configuration:** `SENTRY_DSN`, `SENTRY_ENVIRONMENT`
- **Features:** Unhandled HTTP exception capture, background job failure instrumentation, automatic sensitive data scrubbing.

## 4. Google Maps Platform
- **Service:** Routes API (`https://routes.googleapis.com/directions/v2:computeRoutes`) and Geocoding API.
- **Configuration:** `GOOGLE_MAPS_API_KEY`, `GOOGLE_MAPS_USE_ROUTES_API`
- **Features:** Real road distance (km) and travel duration (minutes) for motorcycle food delivery. Controlled Haversine fallback when offline.

## 5. Redis & BullMQ
- **Packages:** `ioredis`, `bullmq`
- **Configuration:** `REDIS_URL`
- **Features:** Distributed caching with in-memory fallback, rate limiting, and background queues for email, notifications, and delivery timeouts.

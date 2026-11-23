# CHOVIA — Authentication & Token Lifecycle

> **Specification:** Authentication, Session Management, Verification, and Password Reset

## 1. Authentication Architecture
CHOVIA uses **JWT access tokens** paired with **PostgreSQL-persisted refresh token sessions** with automatic family rotation and reuse detection:

| Token | Lifespan | Storage / Transport | Purpose |
|---|---|---|---|
| **Access Token** | 15 minutes | Sent in `Authorization: Bearer <token>` header | Authenticates API requests |
| **Refresh Token** | 30 days | Stored in secure client storage (SecureStore / HttpOnly cookie) | Exchanged for new token pair via `/api/v1/auth/refresh` |

## 2. Mandatory Password & Verification Policy
- All 4 user roles (`CUSTOMER`, `RIDER`, `RESTAURANT_STAFF`, `ADMIN`) must set a password during registration.
- **Email verification is strictly enforced:** Users cannot log in (`POST /api/v1/auth/login`) until their email address is verified. Unverified accounts receive `403 Forbidden` with code `FORBIDDEN` and message `"Please verify your email address before logging in"`.
- Email OTP is exclusively for verification and password reset; passwordless login is prohibited.

## 3. Refresh Token Family Rotation & Reuse Detection
When `/api/v1/auth/refresh` is called:
1. The incoming refresh token's SHA-256 hash is looked up in the `refresh_tokens` database table.
2. If the token is valid, it is marked `revokedAt = NOW()` and replaced by a newly created refresh token within the same `familyId`.
3. If an already-revoked refresh token is presented (indicating token theft or replay), the backend **immediately revokes all tokens belonging to that `familyId`** and returns `401 Unauthorized`.

## 4. Single-Use OTP and Replay Protection
- Verification and password-reset OTPs are 6-digit numeric codes generated with HMAC-SHA256 signatures expiring in 15 minutes.
- When an OTP is consumed, its unique signature is marked in Redis (`consumed_otp:<sig>`) with a TTL. Any replayed attempt with the same OTP or signature is rejected with `"This verification code has already been consumed"`.
- Rate limiting is enforced: maximum 5 requests per minute for OTP requests, and maximum 10 requests per minute for verification submissions.

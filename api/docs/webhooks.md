# CHOVIA — Paystack Webhooks & Verification

> **Specification:** Webhook Signature Verification, Raw Body Handling, and Idempotency

## 1. Webhook Endpoint
- **URL:** `POST /api/v1/payments/webhook`
- **Security:** HMAC-SHA512 signature verified via HTTP header `x-paystack-signature`.

## 2. Raw Body Verification
The backend captures the exact, unmodified byte buffer of the incoming HTTP request using `fastify-raw-body`:
- The signature is verified against the raw request bytes using `crypto.createHmac("sha512", PAYSTACK_WEBHOOK_SECRET)`.
- Buffer lengths are checked before comparison.
- Signatures are compared using `crypto.timingSafeEqual` to prevent timing attacks.
- Requests with invalid signatures are rejected immediately with `400 Bad Request` without parsing the payload.

## 3. Idempotent Processing
- When Paystack sends a `charge.success` event, the server looks up the payment record by `providerReference`.
- If the payment is already in `SUCCESS` status, the webhook immediately returns `{ received: true }` without repeating order confirmation side-effects.
- Amount and currency are validated against the database before state transition.

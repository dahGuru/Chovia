# CHOVIA — API Errors & Status Codes

> **Specification:** Standard Error Response Envelopes and Resolution Guidance

## 1. Unified Error Response Envelope
Every error response returns a consistent JSON payload:

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "details": [
    {
      "path": "email",
      "message": "Invalid email address format"
    }
  ],
  "timestamp": "2026-11-22T21:00:00.000Z"
}
```

## 2. Standard Error Codes
| HTTP Status | Error Code | Description / Resolution |
|---|---|---|
| `400` | `BAD_REQUEST` | Malformed input, business invariant violation (e.g. restaurant closed, distance limit exceeded) |
| `400` | `VALIDATION_ERROR` | Request body, query string, or path parameters failed Zod DTO schema validation |
| `401` | `UNAUTHORIZED` | Missing, malformed, or expired JWT access token; or invalid refresh token |
| `403` | `FORBIDDEN` | Account unverified, account suspended, or unauthorized role/ownership mismatch |
| `404` | `NOT_FOUND` | Resource ID does not exist in the database |
| `409` | `CONFLICT` | Resource already exists (e.g. duplicate email or phone number) |
| `429` | `TOO_MANY_REQUESTS` | Rate limit threshold exceeded (e.g. OTP brute-force protection) |
| `500` | `INTERNAL_SERVER_ERROR` | Unexpected server failure; error is automatically scrubbed and reported to Sentry |

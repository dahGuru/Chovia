# CHOVIA — Payments & Paystack Integration

> **Specification:** Checkout Initialization, Payment Verification, and Authoritative Data Checks

## 1. Authoritative Pricing Model
- All prices, subtotal, delivery fee, and platform commission are calculated on the server.
- The client cannot submit or alter price fields during checkout or payment initialization.
- Monetary amounts are stored as integer minor units (`kobo` for NGN).

## 2. Payment Lifecycle
1. **Order Creation (`POST /api/v1/orders/checkout`):**
   Order is created in `PENDING_PAYMENT` status with calculated amounts.
2. **Payment Initialization (`POST /api/v1/payments/initialize`):**
   Backend communicates with Paystack to initialize a transaction for the exact `totalAmount` in the database. Returns `authorizationUrl` and `reference`.
3. **Customer Checkout:**
   Customer completes payment on Paystack checkout UI.
4. **Authoritative Verification (`GET /api/v1/payments/verify/:reference`):**
   - Server queries Paystack `/transaction/verify/:reference`.
   - **Critical Integrity Check:** The verified amount returned by Paystack MUST equal the exact `expectedAmountMinor` stored in the CHOVIA database for that payment record.
   - If amount or currency mismatch occurs, payment is marked `FAILED` and rejected.
   - If verified, order status is updated to `CONFIRMED` and delivery record is initialized inside an atomic transaction.

# CHOVIA — API Endpoints Catalogue

> **Base URL:** `http://localhost:4000/api/v1`  
> **Interactive Documentation:** `http://localhost:4000/api/docs`

## 1. Auth (`/api/v1/auth`)
- `POST /register`: Register new customer account with password.
- `POST /login`: Authenticate with email/password (requires verified email).
- `POST /refresh`: Rotate refresh token family and obtain new access token.
- `POST /logout`: Revoke active refresh token session.
- `POST /verify-email/request`: Request email verification OTP (rate limited to 5/min).
- `POST /verify-email/verify`: Verify email with 6-digit OTP (rate limited to 10/min).
- `POST /password-reset/request`: Request password reset OTP (rate limited to 5/min).
- `POST /password-reset/verify`: Verify reset OTP and obtain single-use reset token.
- `POST /password-reset/complete`: Complete password reset using reset token.
- `GET /me`: Get authenticated user profile.

## 2. Users & Media (`/api/v1/users`)
- `GET /profile`: Fetch profile.
- `PATCH /profile`: Update name, phone, or avatar.
- `GET /devices`: List user devices.
- `POST /devices`: Register Expo push token.
- `DELETE /devices/:deviceId`: Unregister device.
- `POST /upload-signature`: Obtain signed Cloudinary upload parameters for direct client upload.
- `POST /upload-image`: Server-mediated image upload to Cloudinary.

## 3. Restaurants (`/api/v1/restaurants`)
- `GET /`: Search & filter active restaurants by cuisine, distance, query.
- `GET /:id`: Detailed restaurant profile.
- `POST /onboard`: Submit restaurant onboarding application.
- `PATCH /:id/availability`: Toggle restaurant open/closed status.

## 4. Restaurant Staff (`/api/v1/restaurants`)
- `POST /:restaurantId/staff/invite`: Invite staff member via email.
- `POST /staff/accept-invite`: Accept staff invitation with token.
- `GET /:restaurantId/staff`: List staff memberships.
- `DELETE /:restaurantId/staff/:membershipId`: Revoke staff membership.

## 5. Menu (`/api/v1`)
- `GET /restaurants/:restaurantId/categories`: List categories.
- `POST /restaurants/:restaurantId/categories`: Create category.
- `PATCH /categories/:id`: Update category.
- `DELETE /categories/:id`: Delete category.
- `GET /restaurants/:restaurantId/items`: List menu items.
- `POST /restaurants/:restaurantId/items`: Create menu item.
- `PATCH /items/:id`: Update item details.
- `PATCH /items/:id/availability`: Toggle item availability.
- `GET /restaurants/:restaurantId/menu`: Structured menu grouped by category.

## 6. Addresses (`/api/v1/addresses`)
- `GET /`: List saved delivery addresses.
- `POST /`: Create address with PostGIS Point geometry.
- `PATCH /:id/default`: Set default address.
- `DELETE /:id`: Remove address.

## 7. Cart (`/api/v1/cart`)
- `GET /`: Get active cart with authoritative subtotal.
- `POST /items`: Add item (enforces single-restaurant rule).
- `PATCH /items/:id`: Update item quantity.
- `DELETE /items/:id`: Remove item.
- `DELETE /clear`: Clear cart.

## 8. Orders (`/api/v1/orders`)
- `POST /checkout`: Idempotent checkout creating price snapshots.
- `GET /`: List orders scoped by role.
- `GET /:id`: Detailed order information and status history.
- `POST /:id/cancel`: Cancel order before preparation.
- `POST /:id/accept`: Restaurant accepts order (`PREPARING`).
- `POST /:id/ready`: Restaurant marks order ready (`READY`).
- `POST /:id/reject`: Restaurant rejects order with reason.

## 9. Payments (`/api/v1/payments`)
- `POST /initialize`: Initialize Paystack checkout.
- `GET /verify/:reference`: Authoritative Paystack verification.
- `POST /webhook`: Ingest Paystack HMAC-SHA512 webhook events.

## 10. Delivery (`/api/v1/delivery`)
- `PATCH /status`: Update rider online status and location.
- `GET /assignments/available`: List available delivery assignments.
- `POST /assignments/:id/accept`: Rider accepts assignment.
- `POST /assignments/:id/pickup`: Rider confirms pickup (`OUT_FOR_DELIVERY`).
- `POST /assignments/:id/complete`: Rider confirms delivery (`DELIVERED`).
- `GET /orders/:orderId/track`: Live delivery tracking.

## 11. Notifications (`/api/v1/notifications`)
- `GET /`: List notifications.
- `PATCH /:id/read`: Mark single notification as read.
- `POST /read-all`: Mark all notifications as read.

## 12. Admin (`/api/v1/admin`)
- `GET /metrics`: High-level platform statistics and GMV.
- `POST /restaurants/:id/approve`: Approve restaurant.
- `POST /restaurants/:id/suspend`: Suspend restaurant.
- `POST /riders/:id/approve`: Approve rider profile.
- `POST /riders/:id/suspend`: Suspend rider profile.
- `GET /audit-logs`: Query structured audit log trail.

## 13. Pricing (`/api/v1/pricing`)
- `POST /estimate`: Calculate distance-based delivery fee & platform fee.
- `GET /config`: Retrieve active platform fee and commission settings.

## 14. Favorites (`/api/v1/favorites`)
- `GET /items`: List favorite menu items.
- `POST /toggle/:menuItemId`: Toggle menu item favorite status.

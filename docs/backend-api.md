# CHOVIA — Backend API Documentation

> **Document:** API Endpoint Catalogue, Transport Contracts, and OpenAPI Specification  
> **Status:** Implemented MVP (Automated tests pass; requires staging verification)  
> **Base URL:** `http://localhost:4000/api/v1`  
> **Interactive Documentation (Swagger UI):** `http://localhost:4000/api/docs`  
> **OpenAPI 3.1 Spec:** `http://localhost:4000/api/docs/json`  

---

## 1. General API Conventions

### 1.1 Transport Protocol and Data Format
- All API communication uses **HTTP/1.1** over TLS (or plain HTTP in local development).
- Requests and responses use `Content-Type: application/json`.
- Character encoding is UTF-8.

### 1.2 Authentication Header
Protected endpoints require an `Authorization` header containing a valid JSON Web Token:
```http
Authorization: Bearer <access_token>
```
The access token is an HMAC-SHA256 JWT issued upon successful registration or login with a 15-minute lifespan.

### 1.3 Standard Error Format
When an operation fails (validation error, resource missing, forbidden action, server error), the API returns a structured error object with a corresponding HTTP status code:

```json
{
  "statusCode": 400,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "message": "Invalid email address"
      }
    ]
  }
}
```

Standard error codes:
- `VALIDATION_ERROR` (400): Schema validation failure on request body, query string, or path parameters.
- `BAD_REQUEST` (400): Business rule violation, invalid state transition, or malformed data.
- `UNAUTHORIZED` (401): Missing, malformed, or expired JWT access token.
- `FORBIDDEN` (403): Account suspended, role unauthorized, or resource ownership mismatch.
- `NOT_FOUND` (404): Requested entity does not exist.
- `CONFLICT` (409): Resource already exists (e.g. email or phone number in use).
- `TOO_MANY_REQUESTS` (429): Rate limit exceeded (>100 requests per minute).
- `PAYMENT_GATEWAY_ERROR` (502): External payment provider outage or upstream gateway error.
- `INTERNAL_SERVER_ERROR` (500): Unexpected runtime exception (masked in production).

---

## 2. API Endpoint Catalogue

### 2.1 Authentication Module (`/api/v1/auth`)

| Method | Endpoint | Auth | Roles | Description |
|---|---|---|---|---|
| `POST` | `/auth/register` | None | Public | Register new user account with hashed password and role (CUSTOMER, RIDER, RESTAURANT_STAFF) |
| `POST` | `/auth/login` | None | Public | Authenticate user credentials, record device, issue access & refresh tokens |
| `POST` | `/auth/refresh` | None | Public | Rotate refresh token family; returns fresh access token & rotated refresh token |
| `POST` | `/auth/logout` | None | Public | Revoke active refresh token session |
| `POST` | `/auth/verify-email` | None | Public | Verify user account email using 6-digit HMAC-SHA256 OTP |
| `POST` | `/auth/forgot-password` | None | Public | Generate and dispatch 6-digit password reset OTP |
| `POST` | `/auth/reset-password` | None | Public | Reset password using valid OTP, updating password hash and revoking existing sessions |
| `GET` | `/auth/me` | Bearer | All | Return authenticated user details, verified status, and active role |

---

### 2.2 Users & Media Module (`/api/v1/users`)

| Method | Endpoint | Auth | Roles | Description |
|---|---|---|---|---|
| `GET` | `/users/profile` | Bearer | All | Fetch full profile data including customer/rider profile details |
| `PATCH` | `/users/profile` | Bearer | All | Update user name, phone number, and avatar image URL |
| `POST` | `/users/devices` | Bearer | All | Register or update user client device (Expo Push token, device model, OS) |
| `GET` | `/users/devices` | Bearer | All | List all active devices registered to the authenticated user |
| `POST` | `/users/upload-signature` | Bearer | All | Generate signed Cloudinary upload parameters for avatars, menu, restaurants, or documents |
| `POST` | `/users/upload-image` | Bearer | All | Direct backend upload with magic byte sniffing, format validation, and Cloudinary upload |
| `POST` | `/users/verify-upload` | Bearer | All | Verify client-uploaded asset metadata against folder policies, format restrictions, and size limits |

---

### 2.3 Restaurants Module (`/api/v1/restaurants`)

| Method | Endpoint | Auth | Roles | Description |
|---|---|---|---|---|
| `GET` | `/restaurants` | None | Public | List active restaurants with optional search, cuisine category, and geospatial distance filtering |
| `GET` | `/restaurants/:id` | None | Public | Fetch detailed restaurant profile, operating hours, and active cuisines |
| `POST` | `/restaurants/onboard` | Bearer | All | Submit restaurant onboarding application (creates restaurant with PENDING_APPROVAL status) |
| `PATCH` | `/restaurants/:id/availability` | Bearer | Staff, Admin | Toggle restaurant availability status between OPEN and CLOSED |

---

### 2.4 Restaurant Staff Module (`/api/v1/restaurants`)

| Method | Endpoint | Auth | Roles | Description |
|---|---|---|---|---|
| `POST` | `/restaurants/:restaurantId/staff/invite` | Bearer | Staff, Admin | Invite new staff member via email with assigned role (MANAGER, CHEF, STAFF) |
| `POST` | `/restaurants/staff/accept-invite` | Bearer | Staff | Accept pending staff invitation using cryptographic invitation token |
| `GET` | `/restaurants/:restaurantId/staff` | Bearer | Staff, Admin | List all active and pending staff members for a specific restaurant |
| `DELETE` | `/restaurants/:restaurantId/staff/:membershipId` | Bearer | Staff, Admin | Revoke staff membership from a restaurant |

---

### 2.5 Menu & Categories Module (`/api/v1`)

| Method | Endpoint | Auth | Roles | Description |
|---|---|---|---|---|
| `GET` | `/restaurants/:restaurantId/categories` | None | Public | List all menu categories for a restaurant |
| `POST` | `/restaurants/:restaurantId/categories` | Bearer | Staff, Admin | Create a new menu category for a restaurant |
| `PATCH` | `/categories/:id` | Bearer | Staff, Admin | Update category name, description, or display order |
| `DELETE` | `/categories/:id` | Bearer | Staff, Admin | Delete a menu category |
| `GET` | `/restaurants/:restaurantId/items` | None | Public | List menu items for a restaurant with optional category filter |
| `POST` | `/restaurants/:restaurantId/items` | Bearer | Staff, Admin | Create a new menu item with price, prep time, and image URL |
| `PATCH` | `/items/:id` | Bearer | Staff, Admin | Update menu item details, pricing, or archive status |
| `PATCH` | `/items/:id/availability` | Bearer | Staff, Admin | Toggle item availability between AVAILABLE and OUT_OF_STOCK |
| `GET` | `/restaurants/:restaurantId/menu` | None | Public | Fetch complete structured restaurant menu grouped by category |

---

### 2.6 Delivery Addresses Module (`/api/v1/addresses`)

| Method | Endpoint | Auth | Roles | Description |
|---|---|---|---|---|
| `GET` | `/addresses` | Bearer | Customer | List all saved delivery addresses for the authenticated customer |
| `POST` | `/addresses` | Bearer | Customer | Create delivery address with street address, coordinates, and PostGIS Point geometry |
| `PATCH` | `/addresses/:id/default` | Bearer | Customer | Set designated address as primary default delivery location |
| `DELETE` | `/addresses/:id` | Bearer | Customer | Remove saved delivery address |

---

### 2.7 Cart Module (`/api/v1/cart`)

| Method | Endpoint | Auth | Roles | Description |
|---|---|---|---|---|
| `GET` | `/cart` | Bearer | Customer | Retrieve active cart with authoritative subtotal and item breakdown |
| `POST` | `/cart/items` | Bearer | Customer | Add item to cart; enforces **one-restaurant rule** (clears prior items if new restaurant) |
| `PATCH` | `/cart/items/:id` | Bearer | Customer | Update item quantity in cart (removes item if quantity set to 0) |
| `DELETE` | `/cart/items/:id` | Bearer | Customer | Remove specific item from cart |
| `DELETE` | `/cart/clear` | Bearer | Customer | Clear all items from customer cart and disassociate restaurant |

---

### 2.8 Orders Module (`/api/v1/orders`)

| Method | Endpoint | Auth | Roles | Description |
|---|---|---|---|---|
| `POST` | `/orders/checkout` | Bearer | Customer | Create order from cart with price/address snapshot and optional idempotency key |
| `GET` | `/orders` | Bearer | All | List orders scoped by authenticated user role (Customer, Staff, Admin) |
| `GET` | `/orders/:id` | Bearer | All | Fetch order details, snapshot items, delivery status, and status history |
| `POST` | `/orders/:id/cancel` | Bearer | Customer, Admin | Cancel order before preparation begins; records reason and updates status |
| `POST` | `/orders/:id/accept` | Bearer | Staff, Admin | Restaurant accepts order and begins food preparation (status -> PREPARING) |
| `POST` | `/orders/:id/ready` | Bearer | Staff, Admin | Restaurant marks order preparation finished and ready for rider pickup (status -> READY) |
| `POST` | `/orders/:id/reject` | Bearer | Staff, Admin | Restaurant rejects order with required reason; records status history |

---

### 2.9 Payments Module (`/api/v1/payments`)

| Method | Endpoint | Auth | Roles | Description |
|---|---|---|---|---|
| `POST` | `/payments/initialize` | Bearer | Customer | Initialize Paystack transaction for pending order; returns checkout URL and reference |
| `GET` | `/payments/verify/:reference` | Bearer | Customer, Admin | Verify Paystack transaction status; enforces customer ownership and confirms transition to CONFIRMED |
| `POST` | `/payments/webhook` | None | Public | Ingest Paystack webhook events (`charge.success`, `refund.processed`, `refund.failed`); verifies HMAC-SHA512 `x-paystack-signature` header |
| `POST` | `/payments/refund` | Bearer | Admin | Administratively initiate full or partial order refund via Paystack; logs audit trail and reconciles refund record |

---

### 2.10 Delivery Module (`/api/v1/delivery`)

| Method | Endpoint | Auth | Roles | Description |
|---|---|---|---|---|
| `PATCH` | `/delivery/status` | Bearer | Rider | Update rider status (ONLINE, OFFLINE, BUSY) and current GPS coordinates |
| `GET` | `/delivery/assignments/available` | Bearer | Rider | List unassigned orders ready for delivery within rider service radius |
| `POST` | `/delivery/assignments/:id/accept` | Bearer | Rider | Rider accepts delivery assignment; locks delivery to rider |
| `POST` | `/delivery/assignments/:id/pickup` | Bearer | Rider | Rider confirms food pickup at restaurant; transitions order to IN_TRANSIT |
| `POST` | `/delivery/assignments/:id/complete` | Bearer | Rider | Rider confirms drop-off at customer location; transitions order to DELIVERED |
| `GET` | `/delivery/orders/:orderId/track` | Bearer | Customer, Staff, Admin | Track live delivery status, rider information, and estimated arrival |

---

### 2.11 Notifications Module (`/api/v1/notifications`)

| Method | Endpoint | Auth | Roles | Description |
|---|---|---|---|---|
| `GET` | `/notifications` | Bearer | All | List in-app notifications with unread counts and pagination |
| `PATCH` | `/notifications/:id/read` | Bearer | All | Mark single notification as read |
| `POST` | `/notifications/read-all` | Bearer | All | Mark all user notifications as read |

---

### 2.12 Administration Module (`/api/v1/admin`)

| Method | Endpoint | Auth | Roles | Description |
|---|---|---|---|---|
| `GET` | `/admin/metrics` | Bearer | Admin | High-level platform statistics: total users, active restaurants, orders, GMV |
| `POST` | `/admin/restaurants/:id/approve` | Bearer | Admin | Approve pending restaurant application to ACTIVE status |
| `POST` | `/admin/restaurants/:id/suspend` | Bearer | Admin | Suspend restaurant from platform |
| `POST` | `/admin/riders/:id/approve` | Bearer | Admin | Approve rider onboarding verification to ACTIVE status |
| `POST` | `/admin/riders/:id/suspend` | Bearer | Admin | Suspend rider from accepting deliveries |
| `GET` | `/admin/audit-logs` | Bearer | Admin | Query platform audit log trail with entity and action filters |

---

### 2.13 Pricing & Estimates Module (`/api/v1/pricing`)

| Method | Endpoint | Auth | Roles | Description |
|---|---|---|---|---|
| `POST` | `/pricing/estimate` | None | Public | Calculate authoritative delivery fee, platform fee, and duration for distance |
| `GET` | `/pricing/config` | None | Public | Retrieve active platform commission rates and delivery fee tiers |

---

### 2.14 Favorites Module (`/api/v1/favorites`)

| Method | Endpoint | Auth | Roles | Description |
|---|---|---|---|---|
| `GET` | `/favorites/items` | Bearer | Customer | List saved favorite menu items for the customer |
| `POST` | `/favorites/toggle/:menuItemId` | Bearer | Customer | Toggle menu item favorite status (creates or deletes favorite record) |

---

## 3. Interactive Documentation

To explore and test all API endpoints with interactive schema forms and example payloads:

1. Start the backend development server:
   ```bash
   pnpm --filter @chovia/backend dev
   ```
2. Open your browser and navigate to:
   ```text
   http://localhost:4000/api/docs
   ```
3. Use the Authorize button to provide a Bearer JWT access token obtained from `/api/v1/auth/login`.

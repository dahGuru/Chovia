# CHOVIA — Backend Database & Persistence

> **Document:** PostgreSQL, PostGIS, Prisma 7 Architecture, Schema, and Spatial Handling  
> **Status:** Implemented MVP (Automated tests pass; unapplied migration generated for staging/production review)  
> **Schema File:** [database/prisma/schema.prisma](file:///C:/Users/HP/Videos/WEB DEV 1.0/Food Delivery/Chovia/database/prisma/schema.prisma)  
> **Database Client:** [backend/src/database/prisma.ts](file:///C:/Users/HP/Videos/WEB DEV 1.0/Food Delivery/Chovia/backend/src/database/prisma.ts)  

---

## 1. Database Infrastructure

| Component | Specification |
|---|---|
| Database Engine | PostgreSQL 18 + Neon Serverless PostgreSQL |
| Spatial Extension | PostGIS 3.4+ (`postgis`) |
| Object-Relational Mapping | Prisma ORM 7 (`@prisma/client`, `@prisma/adapter-pg`) |
| Connection Pooling | Node `pg.Pool` with 10 max connections and 30s idle timeout |
| Primary Key Strategy | UUID v4 (`@default(uuid()) @db.Uuid`) |
| Table Mapping | Snake_case table names (`@@map("...")`) |
| Financial Representation | Stored as Decimal in DB; computed as integer minor units in TypeScript |

---

## 2. PostGIS Geometry and Spatial Handling

CHOVIA requires high-precision geospatial capabilities to support:
- Customer delivery address location recording.
- Restaurant geographic coordinate mapping.
- Distance calculation between restaurants and delivery destinations.
- Rider proximity search and real-time delivery assignment.

### Spatial Column Configuration
In [database/prisma/schema.prisma](file:///C:/Users/HP/Videos/WEB DEV 1.0/Food Delivery/Chovia/database/prisma/schema.prisma), `Address` and `Restaurant` models define spatial Point columns with spatial GiST indexing:

```prisma
model Address {
  id        String @id @default(uuid()) @db.Uuid
  // ...
  latitude  Decimal @db.Decimal(10, 8)
  longitude Decimal @db.Decimal(11, 8)
  location  Unsupported("geometry(Point,4326)")?

  @@index([location], type: Gist)
  @@map("addresses")
}

model Restaurant {
  id        String @id @default(uuid()) @db.Uuid
  // ...
  latitude  Decimal @db.Decimal(10, 8)
  longitude Decimal @db.Decimal(11, 8)
  location  Unsupported("geometry(Point,4326)")?

  @@index([location], type: Gist)
  @@map("restaurants")
}
```

### Prisma 7 PostGIS Workaround Pattern
In Prisma ORM 7, models with `Unsupported("geometry(Point,4326)")` types omit the generated `.create()`, `.createMany()`, and `.upsert()` methods from the model delegate.

In strict compliance with `AGENTS.md` (*"Use parameterized raw SQL when required for spatial operations not adequately expressed by Prisma"*), all insertions for `Address` and `Restaurant` use parameterized `prisma.$queryRaw`:

```ts
// Address creation with PostGIS Point geometry:
const [inserted] = await prisma.$queryRaw<Array<{ id: string; ... }>>`
  INSERT INTO "addresses" (
    "id", "customerId", "label", "recipientName", "phoneNumber",
    "street", "landmark", "city", "state", "postalCode", "country",
    "addressText", "latitude", "longitude", "isDefault", "location",
    "createdAt", "updatedAt"
  ) VALUES (
    gen_random_uuid(), ${profile.id}::uuid, ${dto.label}, ${dto.recipientName}, ${dto.phoneNumber},
    ${dto.street}, ${dto.landmark ?? null}, ${dto.city}, ${dto.state}, ${dto.postalCode ?? null}, ${dto.country},
    ${dto.addressText}, ${dto.latitude}, ${dto.longitude}, ${dto.isDefault ?? false},
    ST_SetSRID(ST_MakePoint(${dto.longitude}, ${dto.latitude}), 4326),
    NOW(), NOW()
  )
  RETURNING *;
`;
```

This guarantees that:
1. Spatial geometry points are correctly indexed using PostGIS SRID 4326 (WGS 84).
2. SQL injection is impossible because all parameters are safely bound via tagged template literals.
3. Standard Prisma read, update, and delete queries remain fully functional for all other model operations.

---

## 3. Authoritative Store & ACID Transactions

PostgreSQL is the single authoritative source of truth for CHOVIA's business operations. Critical multi-step state mutations are executed inside `prisma.$transaction`:

1. **Order Checkout (`OrdersService.checkout`):**
   - Validates cart contents and restaurant availability.
   - Computes distance-based delivery fee and platform commission.
   - Creates the `Order` record with authoritative financial totals.
   - Creates individual `OrderItem` snapshot records.
   - Creates initial `OrderStatusHistory` entry (`PENDING_PAYMENT`).
   - Clears cart items and disassociates the cart from the restaurant atomically.
2. **Order Cancellation (`OrdersService.cancelOrder`):**
   - Verifies that order status is `PENDING_PAYMENT` or `PENDING` (before food preparation begins).
   - Inserts audit entry into `OrderStatusHistory`.
   - Updates order status to `CANCELLED` with cancellation timestamp and reason.
3. **Staff Invitation Acceptance (`RestaurantStaffService.acceptInvite`):**
   - Validates invitation token existence and expiration.
   - Creates or activates `RestaurantStaffMembership`.
   - Marks `StaffInvitation` status as `ACCEPTED`.
4. **Delivery Lifecycle State Transitions (`DeliveryService`):**
   - Atomically locks delivery assignment to prevent race conditions among multiple riders.
   - Records transition in `DeliveryAssignmentEvent` and updates order status.

---

## 4. Financial Calculations & Monetary Integrity

- Database schemas store monetary values as `Decimal(10, 2)`.
- Application logic performs all arithmetic exclusively using **integer minor units** (e.g. kobo or cents):
  - `subtotalMinor = Math.round(Number(item.price) * 100) * quantity`
  - `deliveryFeeMinor = calculateDeliveryFee(distanceKm)`
  - `platformFeeMinor = calculatePlatformFee(subtotalMinor)`
- Formatted currency strings (`₦1,500.00`) are provided alongside integer minor units in response DTOs for consistent client rendering.

---

## 5. Schema Extensions & Migration Management (Stage 3.2.2)

### 5.1 Outbox & Reliability Schema
In [database/prisma/schema.prisma](file:///C:/Users/HP/Videos/WEB DEV 1.0/Food Delivery/Chovia/database/prisma/schema.prisma):
- **`OutboxEvent` Model & Distributed Lease Semantics:** Implements transactional outbox durability with explicit distributed lease claiming:
  - `claimToken String? @db.Uuid`: Unique per-worker token generated during atomic claim.
  - `leaseExpiresAt DateTime?`: Explicit TTL expiration preventing worker deadlocks or indefinite locks.
  - Compound index: `@@index([status, leaseExpiresAt])` for fast recovery of stale processing leases.
- **`NotificationDelivery` Model & Tracking:** Durable mobile push delivery lifecycle:
  - `id String @id @default(uuid()) @db.Uuid`
  - `notificationId String @db.Uuid` (relation to `Notification`)
  - `userDeviceId String @db.Uuid` (relation to `UserDevice`)
  - `pushToken String`, `ticketId String?`, `receiptId String?`
  - `status NotificationDeliveryStatus @default(QUEUED)` (`QUEUED`, `SUBMITTED`, `DELIVERED`, `FAILED`)
  - `errorDetails Json?`
  - Compound indexes: `@@index([status, createdAt])`, `@@index([ticketId])`, `@@index([receiptId])`.
- **`Payment.providerTransactionId`:** Tracks external provider numeric or string transaction identifiers with `@unique` constraint.
- **`DeliveryStatus` Lifecycle:** Added `PENDING` to `DeliveryStatus` enum; set `@default(PENDING)` on `Delivery.status`.
- **`Delivery` Retries:** Added `dispatchAttempts Int @default(0)` and `lastDispatchAttemptAt DateTime?` for bounded retry tracking.
- **`RiderProfile` Real-Time Availability:** Added `isOnline Boolean @default(false)`, `isAvailable Boolean @default(true)`, `lastLatitude Decimal? @db.Decimal(10, 7)`, `lastLongitude Decimal? @db.Decimal(10, 7)`, and `lastLocationUpdatedAt DateTime?` with compound index `@@index([status, isOnline, isAvailable])`.

### 5.2 Migration File Policy
In accordance with strict safety constraints (`AGENTS.md` - *"Never run destructive migrations, resets, or data deletion without explicit approval"*):
- Schema changes have been validated via `pnpm db:validate` and the Prisma client generated via `pnpm db:generate`.
- Complete unapplied SQL migrations have been generated under `database/prisma/migrations/`:
  - [database/prisma/migrations/20261123140000_stage_3_2_2_remediation/migration.sql](file:///C:/Users/HP/Videos/WEB DEV 1.0/Food Delivery/Chovia/database/prisma/migrations/20261123140000_stage_3_2_2_remediation/migration.sql)
  - [database/prisma/migrations/20261124080000_outbox_leases_and_notification_deliveries/migration.sql](file:///C:/Users/HP/Videos/WEB DEV 1.0/Food Delivery/Chovia/database/prisma/migrations/20261124080000_outbox_leases_and_notification_deliveries/migration.sql)
- The migrations are **unapplied to remote/production databases** and ready for controlled execution via `pnpm db:deploy` or platform CI/CD pipelines during scheduled maintenance.

-- AlterEnum
ALTER TYPE "DeliveryStatus" ADD VALUE 'PENDING' BEFORE 'READY';

-- CreateEnum
CREATE TYPE "OutboxEventStatus" AS ENUM ('PENDING', 'PROCESSING', 'DISPATCHED', 'FAILED');

-- AlterTable deliveries
ALTER TABLE "deliveries" ALTER COLUMN "status" SET DEFAULT 'PENDING';
ALTER TABLE "deliveries" ADD COLUMN "dispatchAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "deliveries" ADD COLUMN "lastDispatchAttemptAt" TIMESTAMP(3);

-- AlterTable payments
ALTER TABLE "payments" ADD COLUMN "providerTransactionId" TEXT;
CREATE UNIQUE INDEX "payments_providerTransactionId_key" ON "payments"("providerTransactionId");

-- AlterTable rider_profiles
ALTER TABLE "rider_profiles" ADD COLUMN "isOnline" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "rider_profiles" ADD COLUMN "isAvailable" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "rider_profiles" ADD COLUMN "lastLatitude" DECIMAL(10,7);
ALTER TABLE "rider_profiles" ADD COLUMN "lastLongitude" DECIMAL(10,7);
ALTER TABLE "rider_profiles" ADD COLUMN "lastLocationUpdatedAt" TIMESTAMP(3);

CREATE INDEX "rider_profiles_status_isOnline_isAvailable_idx" ON "rider_profiles"("status", "isOnline", "isAvailable");

-- CreateTable outbox_events
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "eventType" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxEventStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex outbox_events
CREATE INDEX "outbox_events_status_scheduledAt_idx" ON "outbox_events"("status", "scheduledAt");
CREATE INDEX "outbox_events_aggregateType_aggregateId_idx" ON "outbox_events"("aggregateType", "aggregateId");

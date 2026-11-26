-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('QUEUED', 'SUBMITTED', 'DELIVERED', 'FAILED');

-- AlterTable
ALTER TABLE "outbox_events"
  ADD COLUMN IF NOT EXISTS "claimToken" UUID,
  ADD COLUMN IF NOT EXISTS "leaseExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "outbox_events_status_leaseExpiresAt_idx" ON "outbox_events"("status", "leaseExpiresAt");

-- CreateTable
CREATE TABLE IF NOT EXISTS "notification_deliveries" (
  "id" UUID NOT NULL,
  "notificationId" UUID NOT NULL,
  "deviceId" UUID,
  "expoPushToken" TEXT NOT NULL,
  "ticketId" TEXT,
  "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'QUEUED',
  "errorMessage" TEXT,
  "receiptStatus" TEXT,
  "submittedAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "notification_deliveries_ticketId_key" ON "notification_deliveries"("ticketId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notification_deliveries_notificationId_idx" ON "notification_deliveries"("notificationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notification_deliveries_status_idx" ON "notification_deliveries"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notification_deliveries_ticketId_idx" ON "notification_deliveries"("ticketId");

-- AddForeignKey
ALTER TABLE "notification_deliveries"
  ADD CONSTRAINT "notification_deliveries_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries"
  ADD CONSTRAINT "notification_deliveries_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "user_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterEnum
ALTER TYPE "RefundStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';

-- DropIndex
DROP INDEX IF EXISTS "refunds_orderId_key";

-- AlterTable
ALTER TABLE "refunds" ADD COLUMN IF NOT EXISTS "providerRefundId" TEXT,
ADD COLUMN IF NOT EXISTS "failureReason" TEXT,
ADD COLUMN IF NOT EXISTS "processedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "refunds_orderId_idx" ON "refunds"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "refunds_providerRefundId_key" ON "refunds"("providerRefundId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "refunds_providerRefundId_idx" ON "refunds"("providerRefundId");

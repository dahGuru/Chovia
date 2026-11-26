-- CreateEnum
CREATE TYPE "RiderKycStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RiderDocumentType" AS ENUM ('GOVERNMENT_ID', 'DRIVER_LICENSE', 'VEHICLE_REGISTRATION', 'SELFIE');

-- AlterTable
ALTER TABLE "rider_profiles"
  ALTER COLUMN "isAvailable" SET DEFAULT false,
  ADD COLUMN IF NOT EXISTS "operatingCity" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "rider_kyc_applications" (
  "id" UUID NOT NULL,
  "riderProfileId" UUID NOT NULL,
  "status" "RiderKycStatus" NOT NULL DEFAULT 'PENDING',
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "operatingCity" TEXT NOT NULL,
  "homeAddress" TEXT,
  "vehicleType" TEXT NOT NULL,
  "vehiclePlateNumber" TEXT,
  "governmentIdType" TEXT NOT NULL,
  "encryptedGovernmentId" TEXT NOT NULL,
  "governmentIdMasked" TEXT NOT NULL,
  "bankName" TEXT NOT NULL,
  "bankCode" TEXT,
  "accountHolderName" TEXT NOT NULL,
  "encryptedBankAccountNumber" TEXT NOT NULL,
  "bankAccountMasked" TEXT NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "reviewedByUserId" UUID,
  "rejectionReason" TEXT,
  "reviewNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "rider_kyc_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "rider_documents" (
  "id" UUID NOT NULL,
  "applicationId" UUID NOT NULL,
  "documentType" "RiderDocumentType" NOT NULL,
  "storageProvider" TEXT NOT NULL DEFAULT 'CLOUDINARY',
  "publicId" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "deliveryType" TEXT NOT NULL DEFAULT 'authenticated',
  "format" TEXT,
  "bytes" INTEGER,
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "rider_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "rider_kyc_applications_riderProfileId_key" ON "rider_kyc_applications"("riderProfileId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "rider_kyc_applications_status_idx" ON "rider_kyc_applications"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "rider_kyc_applications_submittedAt_idx" ON "rider_kyc_applications"("submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "rider_documents_applicationId_documentType_key" ON "rider_documents"("applicationId", "documentType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "rider_documents_applicationId_idx" ON "rider_documents"("applicationId");

-- AddForeignKey
ALTER TABLE "rider_kyc_applications"
  ADD CONSTRAINT "rider_kyc_applications_riderProfileId_fkey" FOREIGN KEY ("riderProfileId") REFERENCES "rider_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rider_documents"
  ADD CONSTRAINT "rider_documents_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "rider_kyc_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

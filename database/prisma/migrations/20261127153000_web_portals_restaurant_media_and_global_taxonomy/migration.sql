-- CreateEnum
CREATE TYPE "GlobalCategoryKind" AS ENUM ('FOOD', 'DRINK');

-- AlterTable
ALTER TABLE "restaurants"
  ADD COLUMN IF NOT EXISTS "logoUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "coverImageUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;

-- AlterTable
ALTER TABLE "cuisine_categories"
  ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "global_categories" (
  "id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "kind" "GlobalCategoryKind" NOT NULL,
  "description" TEXT,
  "imageUrl" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "global_categories_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "menu_items"
  ADD COLUMN IF NOT EXISTS "globalCategoryId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "global_categories_slug_key" ON "global_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "global_categories_kind_name_key" ON "global_categories"("kind", "name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "global_categories_kind_isActive_sortOrder_idx" ON "global_categories"("kind", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "menu_items_globalCategoryId_idx" ON "menu_items"("globalCategoryId");

-- AddForeignKey
ALTER TABLE "menu_items"
  ADD CONSTRAINT "menu_items_globalCategoryId_fkey" FOREIGN KEY ("globalCategoryId") REFERENCES "global_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

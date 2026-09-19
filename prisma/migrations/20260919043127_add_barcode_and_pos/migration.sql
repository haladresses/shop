-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'CASH';

-- CreateEnum
CREATE TYPE "OrderSource" AS ENUM ('ONLINE', 'POS');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "posPinHash" TEXT,
ADD COLUMN "posPinAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "posPinLockedUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "products" ADD COLUMN "barcode" TEXT;
CREATE UNIQUE INDEX "products_barcode_key" ON "products"("barcode");

-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN "barcode" TEXT;
CREATE UNIQUE INDEX "product_variants_barcode_key" ON "product_variants"("barcode");

-- AlterTable
ALTER TABLE "orders" ADD COLUMN "source" "OrderSource" NOT NULL DEFAULT 'ONLINE',
ADD COLUMN "cashierId" TEXT;

-- CreateIndex
CREATE INDEX "orders_cashierId_idx" ON "orders"("cashierId");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

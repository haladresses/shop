-- CreateEnum
CREATE TYPE "ProductDepartment" AS ENUM ('LADIES', 'GIRLS', 'BOYS', 'BABY', 'GIFTS');

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "department" "ProductDepartment",
ADD COLUMN     "legacyData" JSONB,
ADD COLUMN     "supplierId" TEXT;

-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN     "legacyData" JSONB;

-- CreateIndex
CREATE INDEX "products_supplierId_idx" ON "products"("supplierId");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;


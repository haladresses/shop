-- AlterTable
ALTER TABLE "products" ADD COLUMN     "costPrice" DECIMAL(10,3);

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "amountTendered" DECIMAL(10,3),
ADD COLUMN     "changeGiven" DECIMAL(10,3),
ADD COLUMN     "posShiftId" TEXT,
ADD COLUMN     "refundedAmount" DECIMAL(10,3) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "unitCost" DECIMAL(10,3);

-- AlterTable
ALTER TABLE "inventory_transactions" ADD COLUMN     "balanceAfter" INTEGER,
ADD COLUMN     "reference" TEXT,
ADD COLUMN     "unitCost" DECIMAL(10,3);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DECIMAL(10,3) NOT NULL,
    "description" TEXT,
    "paymentMethod" TEXT NOT NULL DEFAULT 'CASH',
    "reference" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" DECIMAL(10,3) NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'CASH',
    "reason" TEXT,
    "items" JSONB,
    "restocked" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_shifts" (
    "id" TEXT NOT NULL,
    "cashierId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "openingCash" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "closingCash" DECIMAL(10,3),
    "expectedCash" DECIMAL(10,3),
    "movements" JSONB,
    "notes" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "pos_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "expenses_date_idx" ON "expenses"("date");

-- CreateIndex
CREATE INDEX "expenses_category_idx" ON "expenses"("category");

-- CreateIndex
CREATE INDEX "refunds_orderId_idx" ON "refunds"("orderId");

-- CreateIndex
CREATE INDEX "refunds_createdAt_idx" ON "refunds"("createdAt");

-- CreateIndex
CREATE INDEX "pos_shifts_cashierId_status_idx" ON "pos_shifts"("cashierId", "status");

-- CreateIndex
CREATE INDEX "pos_shifts_openedAt_idx" ON "pos_shifts"("openedAt");

-- CreateIndex
CREATE INDEX "products_isActive_createdAt_idx" ON "products"("isActive", "createdAt");

-- CreateIndex
CREATE INDEX "products_basePrice_idx" ON "products"("basePrice");

-- CreateIndex
CREATE INDEX "product_variants_color_idx" ON "product_variants"("color");

-- CreateIndex
CREATE INDEX "product_variants_size_idx" ON "product_variants"("size");

-- CreateIndex
CREATE INDEX "orders_createdAt_idx" ON "orders"("createdAt");

-- CreateIndex
CREATE INDEX "orders_paymentStatus_createdAt_idx" ON "orders"("paymentStatus", "createdAt");

-- CreateIndex
CREATE INDEX "orders_source_createdAt_idx" ON "orders"("source", "createdAt");

-- CreateIndex
CREATE INDEX "orders_posShiftId_idx" ON "orders"("posShiftId");

-- CreateIndex
CREATE INDEX "order_items_productId_idx" ON "order_items"("productId");

-- CreateIndex
CREATE INDEX "payments_createdAt_idx" ON "payments"("createdAt");

-- CreateIndex
CREATE INDEX "inventory_quantity_idx" ON "inventory"("quantity");

-- CreateIndex
CREATE INDEX "inventory_transactions_createdAt_idx" ON "inventory_transactions"("createdAt");

-- CreateIndex
CREATE INDEX "inventory_transactions_type_createdAt_idx" ON "inventory_transactions"("type", "createdAt");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_posShiftId_fkey" FOREIGN KEY ("posShiftId") REFERENCES "pos_shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_shifts" ADD CONSTRAINT "pos_shifts_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


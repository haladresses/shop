-- Delivery tracking on orders: when an order was shipped / delivered, its
-- courier tracking number and what the delivery cost the shop.
ALTER TABLE "orders" ADD COLUMN "shippedAt" TIMESTAMP(3),
ADD COLUMN "deliveredAt" TIMESTAMP(3),
ADD COLUMN "trackingNumber" TEXT,
ADD COLUMN "deliveryCost" DECIMAL(10,3);

-- CreateIndex
CREATE INDEX "orders_shippingMethod_createdAt_idx" ON "orders"("shippingMethod", "createdAt");

-- Backfill existing orders.
-- POS sales are handed over at the counter when they are rung up.
UPDATE "orders" SET "shippedAt" = "createdAt", "deliveredAt" = "createdAt"
WHERE "source" = 'POS' AND "status" IN ('DELIVERED', 'REFUNDED');
-- Older online orders: the last status change is the best record available.
UPDATE "orders" SET "shippedAt" = "updatedAt"
WHERE "source" = 'ONLINE' AND "status" IN ('SHIPPED', 'DELIVERED') AND "shippedAt" IS NULL;
UPDATE "orders" SET "deliveredAt" = "updatedAt"
WHERE "source" = 'ONLINE' AND "status" = 'DELIVERED' AND "deliveredAt" IS NULL;

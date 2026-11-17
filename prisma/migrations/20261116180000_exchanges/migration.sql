-- Exchanges: credit from returned goods applied to a replacement sale.
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'EXCHANGE_CREDIT';

ALTER TABLE "refunds" ADD COLUMN IF NOT EXISTS "exchangeOrderId" TEXT,
ADD COLUMN IF NOT EXISTS "exchangeOrderNumber" TEXT;

CREATE INDEX IF NOT EXISTS "refunds_exchangeOrderId_idx" ON "refunds"("exchangeOrderId");

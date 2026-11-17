-- POS screen lock: a locked session is treated as signed out until unlocked
-- with the owner's POS PIN (see /api/pos/lock).

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "lockedAt" TIMESTAMP(3);

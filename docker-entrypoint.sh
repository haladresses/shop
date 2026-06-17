#!/bin/sh
set -e

# ─────────────────────────────────────────────────────────────
# Sync the database schema. This project manages its schema with
# `prisma db push` (there is no migrations folder), so we apply
# the schema on every startup. It is a no-op when already in sync.
# ─────────────────────────────────────────────────────────────
echo "→ Applying Prisma schema (db push)..."
npx prisma db push --skip-generate

# Optional first-run seed. Enable by setting RUN_SEED=true.
# Non-fatal: a seed failure must never prevent the app from starting.
if [ "$RUN_SEED" = "true" ]; then
  echo "→ Seeding database..."
  npx prisma db seed || echo "⚠ Seeding failed (continuing startup)."
fi

echo "→ Starting Next.js on ${HOSTNAME:-0.0.0.0}:${PORT:-3000}..."
exec npm run start -- -H "${HOSTNAME:-0.0.0.0}" -p "${PORT:-3000}"

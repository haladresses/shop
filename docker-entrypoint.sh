#!/bin/sh
set -e

# ─────────────────────────────────────────────────────────────
# Sync the database schema. This project manages its schema with
# `prisma db push` (there is no migrations folder), so we apply
# the schema on every startup as a fallback. The `init` service in
# docker-compose runs this before the app starts.
# ─────────────────────────────────────────────────────────────
echo "→ Applying Prisma schema (db push)..."
npx prisma db push --skip-generate

echo "→ Starting Next.js on ${HOSTNAME:-0.0.0.0}:${PORT:-3000}..."
exec npm run start -- -H "${HOSTNAME:-0.0.0.0}" -p "${PORT:-3000}"

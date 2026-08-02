#!/bin/sh
set -e

echo "→ Applying Prisma schema (db push)..."
npx prisma db push --skip-generate

if [ "$RUN_SEED" = "true" ]; then
  echo "→ Seeding database..."
  npx prisma db seed
else
  echo "→ Skipping seed (RUN_SEED is not true)."
fi

echo "→ Init complete."
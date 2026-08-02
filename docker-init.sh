#!/bin/sh
set -e

sync_seed_assets() {
  source_dir="/app/seed-assets/products"
  target_dir="/app/public/images/products"

  if [ ! -d "$source_dir" ]; then
    return 0
  fi

  mkdir -p "$target_dir"
  cp -Rn "$source_dir"/. "$target_dir"/
}

database_is_empty() {
  node <<'NODE'
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

(async () => {
  const [users, categories, products] = await Promise.all([
    prisma.user.count(),
    prisma.category.count(),
    prisma.product.count(),
  ]);

  await prisma.$disconnect();
  process.exit(users === 0 && categories === 0 && products === 0 ? 0 : 1);
})().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect().catch(() => {});
  process.exit(2);
});
NODE
}

echo "→ Applying Prisma schema (db push)..."
npx prisma db push --skip-generate

sync_seed_assets

should_seed=false
if [ "$RUN_SEED" = "true" ]; then
  should_seed=true
elif database_is_empty; then
  should_seed=true
fi

if [ "$should_seed" = "true" ]; then
  echo "→ Seeding database..."
  npx prisma db seed
else
  echo "→ Skipping seed (database already has data and RUN_SEED is not true)."
fi

echo "→ Init complete."
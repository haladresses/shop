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

# `prisma db push` stops with "use --accept-data-loss" even for harmless
# additive changes (e.g. a new nullable @unique column), which would leave the
# init service failing on every deploy. Passing that flag blindly could also
# let a genuinely destructive change through, and nothing on the server may
# ever be deleted. So we preview the exact SQL first and only push when it
# contains nothing that drops or rewrites existing data.
apply_schema() {
  diff_file="$(mktemp)"
  destructive='DROP (TABLE|COLUMN|TYPE|SCHEMA)|TRUNCATE|DELETE FROM|SET DATA TYPE'

  npx prisma migrate diff \
    --from-url "$DATABASE_URL" \
    --to-schema-datamodel prisma/schema.prisma \
    --script > "$diff_file"

  if grep -Eiq "$destructive" "$diff_file"; then
    echo "✖ Refusing to apply schema: it would remove or rewrite existing data:" >&2
    grep -Ei "$destructive" "$diff_file" >&2
    echo "  Nothing was changed. Handle this change manually (backup first)." >&2
    rm -f "$diff_file"
    exit 1
  fi

  rm -f "$diff_file"
  npx prisma db push --skip-generate --accept-data-loss
}

echo "→ Applying Prisma schema (additive changes only)..."
apply_schema

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
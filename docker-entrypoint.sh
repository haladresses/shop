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

# ─────────────────────────────────────────────────────────────
# Sync the database schema. This project manages its schema with
# `prisma db push` (there is no migrations folder), so we apply
# the schema on every startup as a fallback. The `init` service in
# docker-compose runs this before the app starts.
# ─────────────────────────────────────────────────────────────
echo "→ Applying Prisma schema (db push)..."
npx prisma db push --skip-generate

sync_seed_assets

echo "→ Starting Next.js on ${HOSTNAME:-0.0.0.0}:${PORT:-3000}..."
exec npm run start -- -H "${HOSTNAME:-0.0.0.0}" -p "${PORT:-3000}"

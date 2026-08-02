# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────
# Base image (Node 20 on Alpine). openssl & libc6-compat are
# required by the Prisma query engine on Alpine/musl.
# postgresql16-client provides pg_dump/psql (matching the
# postgres:16-alpine service in docker-compose.yml) used by the
# admin panel's database backup/restore feature.
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl postgresql16-client

# ─────────────────────────────────────────────────────────────
# Stage 1: install dependencies (with dev deps – needed for the
# build and for `prisma db seed`, which runs via ts-node).
# ─────────────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# NOTE: `npm ci` is avoided here on purpose. `@prisma/client` declares the
# `prisma` CLI as an *optional peer dependency*, which `npm ci` installs as an
# empty directory (a known npm quirk) — breaking `prisma generate`. `npm install`
# resolves it correctly while still respecting the committed lockfile versions.
RUN npm install --no-audit --no-fund

# ─────────────────────────────────────────────────────────────
# Stage 2: build the Next.js app
# ─────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

# NEXT_PUBLIC_* values are inlined at build time.
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ARG NEXT_PUBLIC_APP_NAME="Hala Dresses"
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME

# Generate the Prisma client for this (Alpine) platform, then build.
RUN npx prisma generate
RUN npm run build

# ─────────────────────────────────────────────────────────────
# Stage 3: production runner
# ─────────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# App artifacts + everything needed to run `next start` and
# `prisma db push` / `prisma db seed` at container startup.
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.js ./next.config.js
# tsconfig.json is needed by `prisma db seed` (ts-node reads the seed tsconfig,
# which extends this root config).
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY docker-init.sh ./docker-init.sh
COPY docker-entrypoint.sh ./docker-entrypoint.sh

# Ensure the upload/backup targets exist and are writable by the app user.
RUN chmod +x ./docker-entrypoint.sh ./docker-init.sh \
    && mkdir -p ./public/images/products ./backups \
    && chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]

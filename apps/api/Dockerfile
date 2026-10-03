# syntax=docker/dockerfile:1
#
# ResQ-Go API — NestJS
#
# Build from the repository root so the npm workspace can be resolved:
#   docker build -f apps/api/Dockerfile -t resq-go-api .
#
# Layers are ordered so dependency installation is cached independently of
# source changes.

# ---------------------------------------------------------------------------
# Dependencies: install the whole workspace exactly as the lockfile says.
# ---------------------------------------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /app

# Prisma's engine download needs certificates and OpenSSL.
RUN apk add --no-cache openssl ca-certificates

# Only the manifests, so this layer is only invalidated when dependencies change.
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/config/package.json ./packages/config/
COPY packages/eslint-config/package.json ./packages/eslint-config/

# --ignore-scripts: the Prisma client is generated explicitly below, where the
# schema is guaranteed to be present.
RUN npm ci --ignore-scripts

# ---------------------------------------------------------------------------
# Build: compile shared packages first, then the API.
# ---------------------------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl ca-certificates

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate --schema apps/api/prisma/schema.prisma

RUN npm run build --workspace @abs/contracts \
 && npm run build --workspace @abs/config \
 && npm run build --workspace @abs/api

# ---------------------------------------------------------------------------
# Migrate: schema push + seed.
#
# The runtime image deliberately excludes the Prisma CLI and ts-node, so schema
# changes run from this stage instead. It is a one-shot service in Compose; the
# API waits for it to finish successfully before starting.
# ---------------------------------------------------------------------------
FROM build AS migrate
WORKDIR /app
ENV NODE_ENV=production
CMD ["sh", "-c", "npx prisma db push --schema apps/api/prisma/schema.prisma --skip-generate && npm run seed --workspace @abs/api"]

# ---------------------------------------------------------------------------
# Production dependencies: prune to what the API actually needs to run.
# ---------------------------------------------------------------------------
FROM node:20-alpine AS prod-deps
WORKDIR /app
RUN apk add --no-cache openssl ca-certificates

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/config/package.json ./packages/config/
COPY packages/eslint-config/package.json ./packages/eslint-config/

RUN npm ci --omit=dev --ignore-scripts

# ---------------------------------------------------------------------------
# Runtime
# ---------------------------------------------------------------------------
FROM node:20-alpine AS runtime
WORKDIR /app

RUN apk add --no-cache openssl ca-certificates wget

ENV NODE_ENV=production \
    PORT=3001

# The unprivileged user that ships with the base image.
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build     --chown=node:node /app/apps/api/dist ./apps/api/dist
COPY --from=build     --chown=node:node /app/apps/api/prisma ./apps/api/prisma
COPY --from=build     --chown=node:node /app/apps/api/scripts ./apps/api/scripts
COPY --from=build     --chown=node:node /app/apps/api/package.json ./apps/api/package.json
COPY --chown=node:node apps/api/docker-entrypoint.sh ./apps/api/docker-entrypoint.sh
RUN chmod +x ./apps/api/docker-entrypoint.sh

# Shared workspace packages are resolved through node_modules symlinks, so the
# package directories themselves must exist alongside their build output.
COPY --from=build --chown=node:node /app/packages/contracts/package.json ./packages/contracts/package.json
COPY --from=build --chown=node:node /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=build --chown=node:node /app/packages/config/package.json ./packages/config/package.json
COPY --from=build --chown=node:node /app/packages/config/dist ./packages/config/dist
COPY --from=build --chown=node:node /app/package.json ./package.json

USER node

EXPOSE 3001

# Liveness only: it must not depend on the database, or a database blip would
# restart an otherwise healthy process. Readiness is exposed separately at
# /api/v1/health/ready and answers 503 when a dependency is down.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:${PORT}/api/v1/health || exit 1

ENTRYPOINT ["./apps/api/docker-entrypoint.sh"]
CMD ["node", "apps/api/dist/main.js"]
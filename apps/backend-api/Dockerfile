# Multi-Stage Production Dockerfile for SIM-RT Backend API
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies for native sharp & argon2 compilation
RUN apk add --no-cache python3 make g++ gcc libc-dev vips-dev

# Install pnpm
RUN npm install -g pnpm@12.14.0

# Copy monorepo configuration
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages/shared-types ./packages/shared-types
COPY apps/backend-api ./apps/backend-api

# Install dependencies and build
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @simrt/shared-types build
RUN pnpm --filter backend-api db:generate
RUN pnpm --filter backend-api build

# Production Runner
FROM node:22-alpine AS runner

WORKDIR /app

RUN apk add --no-cache dumb-init vips

ENV NODE_ENV=production
ENV PORT=3001

# Run as non-root node user
USER node

COPY --chown=node:node --from=builder /app/package.json ./package.json
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --chown=node:node --from=builder /app/packages/shared-types/package.json ./packages/shared-types/package.json
COPY --chown=node:node --from=builder /app/apps/backend-api/dist ./apps/backend-api/dist
COPY --chown=node:node --from=builder /app/apps/backend-api/package.json ./apps/backend-api/package.json
COPY --chown=node:node --from=builder /app/apps/backend-api/prisma ./apps/backend-api/prisma

EXPOSE 3001

CMD ["dumb-init", "node", "apps/backend-api/dist/main.js"]

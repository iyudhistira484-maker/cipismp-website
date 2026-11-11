# syntax=docker/dockerfile:1.7
# CipiSMP Store — image produksi Next.js (standalone) + image worker.

ARG NODE_VERSION=22-alpine

FROM node:${NODE_VERSION} AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat
ENV NEXT_TELEMETRY_DISABLED=1

# ---------------------------------------------------------------- dependencies
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# --------------------------------------------------------------------- build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Nilai dummy hanya agar env validation tidak menggagalkan `next build`;
# nilai sebenarnya diberikan saat runtime lewat env_file.
ENV APP_URL=http://localhost:3000 \
    DATABASE_URL=postgres://user:pass@localhost:5432/db \
    SESSION_SECRET=build-only-secret-build-only-secret \
    ENCRYPTION_KEY=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA= \
    EMAIL_PROVIDER=outbox \
    MINECRAFT_LOOKUP_MODE=mock \
    TURNSTILE_ENABLED=0
RUN npm run build

# --------------------------------------------------------------- web runner
FROM base AS runner
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=nextjs:nodejs /app/drizzle.config.ts ./
COPY --from=builder --chown=nextjs:nodejs /app/src/server/db/schema.ts ./src/server/db/schema.ts
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]

# ------------------------------------------------------------- worker runner
FROM base AS worker
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json drizzle.config.ts ./
COPY src ./src
COPY scripts ./scripts
COPY drizzle ./drizzle
USER node
CMD ["npx", "tsx", "src/worker/index.ts"]

# --------------------------------------------------------------- migration
FROM worker AS migrate
CMD ["npx", "drizzle-kit", "migrate"]

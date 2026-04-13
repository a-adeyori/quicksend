# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ── Stage 2: Production ────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache dumb-init openssl libc6-compat

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY prisma ./prisma

# Regenerate client + engines in this image (OpenSSL / musl must match runtime Alpine)
RUN npx prisma generate

# Non-root user — owns /app so prisma migrate can use bundled engines on Alpine
RUN addgroup -g 1001 -S nodejs && adduser -S quicksend -u 1001 -G nodejs \
  && chown -R quicksend:nodejs /app
USER quicksend

EXPOSE 3001

# dumb-init handles signal forwarding so graceful shutdown works
ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/index.js"]
# syntax=docker/dockerfile:1.7

# ---- build stage ----
FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY src ./src

# Bundle local-server.ts + all deps into a single JS file — no node_modules
# needed at runtime, minimal image.
RUN pnpm exec esbuild src/local-server.ts \
      --bundle --platform=node --target=node22 \
      --outfile=dist/local-server.js

# ---- runtime stage ----
FROM node:22-alpine AS runtime
WORKDIR /app

# Non-root user
RUN addgroup -S app && adduser -S app -G app
USER app

COPY --from=builder /app/dist/local-server.js ./

ENV NODE_ENV=production
EXPOSE 3003

CMD ["node", "local-server.js"]

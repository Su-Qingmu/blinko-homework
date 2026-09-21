# syntax=docker/dockerfile:1.7
# -----------------------------------------------------------------------------
# Blinko-Lite · multi-arch (linux/amd64, linux/arm64) production image
# - Stage 1 (builder):  oven/bun:1      — install deps, build frontend + backend
# - Stage 2 (runner):   oven/bun:1-slim — runtime, non-root user, healthcheck
# -----------------------------------------------------------------------------

ARG BUN_IMAGE=oven/bun:1.2.8

# =========================================================
# Stage 1 — builder
# =========================================================
FROM ${BUN_IMAGE} AS builder
WORKDIR /repo

# Native modules (sqlite3 / sharp / onnxruntime) need a C/C++ toolchain.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
        python3 make g++ pkg-config openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Workspace manifests first → better Docker layer caching.
COPY package.json bun.lock* turbo.json .npmrc ./
COPY app/package.json         ./app/
COPY server/package.json      ./server/
COPY shared/package.json      ./shared/
COPY prisma                   ./prisma

# Install all workspace deps. bun resolves tsconfig path aliases
# (e.g. @prisma/* → ./prisma/*) when bundling.
# Note: NOT using --frozen-lockfile here — bun's postinstall hook downloads
# Prisma engine binaries which may have moved between releases; allowing
# lockfile sync keeps the build green when the lockfile drifts slightly.
ENV CI=true
RUN bun install

# Bring in the rest of the source.
COPY . .

# Build the frontend (Vite → ../dist/public) and the backend
# (esbuild → ../dist/index.js) via the existing turbo task.
ENV NODE_ENV=production
ENV DISABLE_PWA=true
RUN bun run build:web

# Regenerate the Prisma client so engine binaries match the target arch
# (binaryTargets in schema.prisma already covers linux + linux-arm64).
RUN bunx prisma generate


# =========================================================
# Stage 2 — runtime
# =========================================================
FROM ${BUN_IMAGE}-slim AS runner
WORKDIR /app

# Minimal runtime libs (openssl for Prisma + TLS, wget for healthcheck).
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
        openssl ca-certificates wget tini \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --system --gid 1001 blinko \
 && useradd  --system --uid 1001 --gid blinko --home /home/blinko --shell /sbin/nologin blinko \
 && mkdir -p /home/blinko /app/data \
 && chown -R blinko:blinko /app /home/blinko

ENV NODE_ENV=production \
    PORT=1111 \
    DISABLE_PWA=true \
    PRISMA_HIDE_UPDATE_MESSAGE=1

# --- artifacts copied from the builder --------------------------------------
# Server bundle + frontend assets.
COPY --from=builder --chown=blinko:blinko /repo/dist/index.js   /app/dist/index.js
COPY --from=builder --chown=blinko:blinko /repo/dist/public     /app/dist/public

# Workspace node_modules (includes @prisma/client + native bindings).
COPY --from=builder --chown=blinko:blinko /repo/node_modules    /app/node_modules

# Prisma schema + migrations (needed by `prisma migrate deploy` at startup).
COPY --from=builder --chown=blinko:blinko /repo/prisma          /app/prisma

# Container entrypoint: apply migrations, then start the server.
COPY --from=builder --chown=blinko:blinko /repo/scripts/docker-entrypoint.sh \
                    /usr/local/bin/docker-entrypoint.sh
RUN chmod 0755 /usr/local/bin/docker-entrypoint.sh

# Server expects static files at /app/server/public (resolved relative to
# /app/dist/index.js via `path.resolve(__dirname, '../server')`).
RUN mkdir -p /app/server \
 && cp -R /app/dist/public /app/server/public \
 && chown -R blinko:blinko /app/server

USER blinko

EXPOSE 1111
VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:1111/health > /dev/null 2>&1 || exit 1

# tini = PID 1, reaps zombies, forwards signals to the server.
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]

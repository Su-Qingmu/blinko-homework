#!/bin/sh
# Blinko-Lite container entrypoint
# - Runs pending Prisma migrations (idempotent — safe on every start)
# - Starts the bundled Express + tRPC server on $PORT (default 1111)
set -eu

DATA_DIR="${DATA_DIR:-/app/data}"
mkdir -p "$DATA_DIR"

# Default to a writable SQLite file under the data volume.
export DATABASE_URL="${DATABASE_URL:-file:${DATA_DIR}/dev.db}"

echo "[blinko] entrypoint starting"
echo "[blinko]   NODE_ENV      = ${NODE_ENV:-development}"
echo "[blinko]   PORT          = ${PORT:-1111}"
echo "[blinko]   DATABASE_URL  = ${DATABASE_URL}"
echo "[blinko]   NEXTAUTH_URL  = ${NEXTAUTH_URL:-<unset>}"

cd /app

# Apply pending Prisma migrations. `migrate deploy` is non-interactive and
# safe to run on every container start.
echo "[blinko] applying Prisma migrations..."
if ! bunx prisma migrate deploy >/tmp/prisma-migrate.log 2>&1; then
  echo "[blinko] prisma migrate deploy failed; attempting prisma db push as fallback"
  cat /tmp/prisma-migrate.log
  bunx prisma db push --skip-generate --accept-data-loss \
    >/tmp/prisma-dbpush.log 2>&1 \
    || { echo "[blinko] FATAL: prisma db push failed"; cat /tmp/prisma-dbpush.log; exit 1; }
fi

echo "[blinko] starting server on 0.0.0.0:${PORT:-1111}"
exec bun /app/dist/index.js

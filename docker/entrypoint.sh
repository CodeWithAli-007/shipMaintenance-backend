#!/bin/sh
set -eu

MEDIA_DIR="${MEDIA_STORAGE_PATH:-/app/data/media}"
mkdir -p "$MEDIA_DIR"
chown -R app:app /app/data

echo "Waiting for PostgreSQL at ${POSTGRES_HOST:-postgres}:${POSTGRES_PORT:-5432}..."
i=0
while [ "$i" -lt 60 ]; do
  if node -e "
    const net = require('net');
    const host = process.env.POSTGRES_HOST || 'postgres';
    const port = Number(process.env.POSTGRES_PORT || 5432);
    const socket = net.connect(port, host, () => { socket.end(); process.exit(0); });
    socket.on('error', () => process.exit(1));
    setTimeout(() => process.exit(1), 2000);
  "; then
    break
  fi
  i=$((i + 1))
  sleep 2
done

if [ "$i" -ge 60 ]; then
  echo "PostgreSQL did not become ready in time" >&2
  exit 1
fi

echo "Running database migrations..."
su-exec app node ./node_modules/typeorm/cli.js migration:run -d dist/data-source.js

echo "Starting API on port ${PORT:-4090}..."
exec su-exec app node dist/index.js

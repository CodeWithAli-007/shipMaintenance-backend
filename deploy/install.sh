#!/usr/bin/env bash
# Deploy / update Ship Maintenance API on a Hostinger VPS (systemd).
# Run from the backend directory as root (or with sudo).
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SERVICE_NAME="ship-maintenance-api"
SERVICE_SRC="$APP_DIR/deploy/ship-maintenance-api.service"
SERVICE_DST="/etc/systemd/system/${SERVICE_NAME}.service"
APP_USER="${APP_USER:-www-data}"

cd "$APP_DIR"

if [[ ! -f .env ]]; then
  echo "Missing .env — copy .env.example to .env and set production values first." >&2
  exit 1
fi

if ! command -v node >/dev/null || ! command -v npm >/dev/null; then
  echo "Node.js / npm not found. Install Node 20+ first." >&2
  exit 1
fi

echo "Installing dependencies..."
npm ci

echo "Building..."
npm run build

echo "Running migrations..."
node ./node_modules/typeorm/cli.js migration:run -d dist/data-source.js

mkdir -p .data/media
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
# Keep .env readable only by the service user
chmod 640 .env
chown root:"$APP_USER" .env

echo "Installing systemd unit..."
cp "$SERVICE_SRC" "$SERVICE_DST"

# Point ExecStart at the real node binary (nvm / nodesource paths vary)
NODE_BIN="$(command -v node)"
sed -i "s|^ExecStart=.*|ExecStart=${NODE_BIN} dist/index.js|" "$SERVICE_DST"
sed -i "s|^User=.*|User=${APP_USER}|" "$SERVICE_DST"
sed -i "s|^Group=.*|Group=${APP_USER}|" "$SERVICE_DST"
sed -i "s|^WorkingDirectory=.*|WorkingDirectory=${APP_DIR}|" "$SERVICE_DST"
sed -i "s|^EnvironmentFile=.*|EnvironmentFile=${APP_DIR}/.env|" "$SERVICE_DST"

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"
systemctl --no-pager --full status "$SERVICE_NAME" || true

PORT="$(grep -E '^PORT=' .env | cut -d= -f2- || echo 4090)"
echo ""
echo "Deployed. Health check:"
echo "  curl http://127.0.0.1:${PORT}/api/health"

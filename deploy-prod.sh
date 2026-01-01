#!/usr/bin/env bash
set -euo pipefail

# Deploy helper for production servers.
# Expected layout: repository checked out on the server, with Node.js + npm available.
# Adjust SERVICE_NAME / WORKDIR if your systemd unit differs.

SERVICE_NAME="${SERVICE_NAME:-lila-backend.service}"
WORKDIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "[deploy] repo: $WORKDIR"
echo "[deploy] service: $SERVICE_NAME"

cd "$WORKDIR"

echo "[deploy] git pull --ff-only"
git pull --ff-only

echo "[deploy] backend build + migrations"
cd "$WORKDIR/backend"
npm ci
npm run build
npm run migration:run

echo "[deploy] restarting systemd service: $SERVICE_NAME"
sudo systemctl restart "$SERVICE_NAME"
sudo systemctl --no-pager --full status "$SERVICE_NAME" || true

echo "[deploy] done"


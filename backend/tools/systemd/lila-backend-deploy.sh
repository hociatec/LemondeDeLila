#!/usr/bin/env bash
set -euo pipefail

LOCK_FILE="/run/lila-backend-deploy.lock"
REPO_DIR="/home/ubuntu/lemondeDeLila"
BACKEND_DIR="$REPO_DIR/backend"
SERVICE_NAME="lila-backend.service"

mkdir -p "$(dirname "$LOCK_FILE")"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "[deploy] already running (lock: $LOCK_FILE)" >&2
  exit 2
fi

echo "[deploy] repo: $REPO_DIR"
echo "[deploy] backend: $BACKEND_DIR"
echo "[deploy] service: $SERVICE_NAME"

cd "$BACKEND_DIR"

echo "[deploy] npm ci"
npm ci

echo "[deploy] npm run build"
npm run build

echo "[deploy] npm run migration:run"
npm run migration:run

echo "[deploy] systemctl restart $SERVICE_NAME"
systemctl restart "$SERVICE_NAME"

echo "[deploy] done"


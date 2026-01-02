#!/usr/bin/env bash
set -euo pipefail

LILA_REPO_DIR="${LILA_REPO_DIR:-}"
BACKEND_SERVICE="${BACKEND_SERVICE:-lila-backend.service}"
DEPLOY_USER="${DEPLOY_USER:-backend}"

if [[ -z "$LILA_REPO_DIR" ]]; then
  echo "[deploy] ERROR: LILA_REPO_DIR is not set (edit the systemd unit)"
  exit 2
fi

if [[ ! -d "$LILA_REPO_DIR" ]]; then
  echo "[deploy] ERROR: repo dir not found: $LILA_REPO_DIR"
  exit 2
fi

echo "[deploy] repo: $LILA_REPO_DIR"
echo "[deploy] backend service: $BACKEND_SERVICE"
echo "[deploy] deploy user: $DEPLOY_USER"

run_as_deploy_user() {
  if id -u "$DEPLOY_USER" >/dev/null 2>&1; then
    # shellcheck disable=SC2016
    runuser -u "$DEPLOY_USER" -- "$@"
  else
    echo "[deploy] WARN: user '$DEPLOY_USER' not found; running as current user"
    "$@"
  fi
}

cd "$LILA_REPO_DIR"

echo "[deploy] git pull --ff-only"
run_as_deploy_user git pull --ff-only

echo "[deploy] backend: npm ci/build/migrations"
run_as_deploy_user bash -lc "cd \"$LILA_REPO_DIR/backend\" && npm ci && npm run build && npm run migration:run"

echo "[deploy] restarting systemd service: $BACKEND_SERVICE"
systemctl restart "$BACKEND_SERVICE"
systemctl --no-pager --full status "$BACKEND_SERVICE" || true

echo "[deploy] done"


#!/usr/bin/env bash
set -euo pipefail

LILA_REPO_DIR="${LILA_REPO_DIR:-}"
BACKEND_SERVICE="${BACKEND_SERVICE:-lila-backend.service}"
DEPLOY_USER="${DEPLOY_USER:-backend}"
DEPLOY_LOCK_FILE="${DEPLOY_LOCK_FILE:-/var/lock/lemonde-deploy.lock}"

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
echo "[deploy] lock: $DEPLOY_LOCK_FILE"

mkdir -p "$(dirname "$DEPLOY_LOCK_FILE")"
exec 9>"$DEPLOY_LOCK_FILE"
if ! flock -n 9; then
  CURRENT_PID="$(cat "$DEPLOY_LOCK_FILE" 2>/dev/null || true)"
  echo "[deploy] ERROR: deploy lock already held (pid=${CURRENT_PID:-unknown})"
  exit 99
fi
echo "$$" >"$DEPLOY_LOCK_FILE"
trap 'rm -f "$DEPLOY_LOCK_FILE"' EXIT

run_as_deploy_user() {
  if id -u "$DEPLOY_USER" >/dev/null 2>&1; then
    # shellcheck disable=SC2016
    runuser -u "$DEPLOY_USER" -- "$@"
  else
    echo "[deploy] WARN: user '$DEPLOY_USER' not found; running as current user"
    "$@"
  fi
}

retry() {
  local attempts="$1"
  local delay_s="$2"
  shift 2
  local i=1
  while true; do
    if "$@"; then
      return 0
    fi
    if (( i >= attempts )); then
      echo "[deploy] ERROR: command failed after $i attempts: $*"
      return 1
    fi
    echo "[deploy] WARN: command failed (attempt $i/$attempts), retrying in ${delay_s}s: $*"
    sleep "$delay_s"
    i=$(( i + 1 ))
  done
}

cd "$LILA_REPO_DIR"

echo "[deploy] git pull --ff-only"
retry 3 3 run_as_deploy_user git pull --ff-only

echo "[deploy] backend: npm ci/build/migrations"
retry 2 5 run_as_deploy_user bash -lc "cd \"$LILA_REPO_DIR/backend\" && npm ci && npm run build && npm run migration:run"

echo "[deploy] restarting systemd service: $BACKEND_SERVICE"
systemctl restart "$BACKEND_SERVICE"
systemctl --no-pager --full status "$BACKEND_SERVICE" || true

echo "[deploy] done"


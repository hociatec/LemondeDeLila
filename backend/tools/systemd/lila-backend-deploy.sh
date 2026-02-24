#!/usr/bin/env bash
set -euo pipefail

LILA_REPO_DIR="${LILA_REPO_DIR:-}"
BACKEND_SERVICE="${BACKEND_SERVICE:-lila-backend.service}"
DEPLOY_USER="${DEPLOY_USER:-}"
DEPLOY_LOCK_FILE="${DEPLOY_LOCK_FILE:-/var/lock/lemonde-deploy.lock}"
EFFECTIVE_DEPLOY_USER=""
SERVICE_WAS_ACTIVE=0
SERVICE_STOPPED=0

if [[ -z "$LILA_REPO_DIR" ]]; then
  echo "[deploy] ERROR: LILA_REPO_DIR is not set (edit the systemd unit)"
  exit 2
fi

if [[ ! -d "$LILA_REPO_DIR" ]]; then
  echo "[deploy] ERROR: repo dir not found: $LILA_REPO_DIR"
  exit 2
fi

resolve_repo_owner_user() {
  local owner
  owner="$(stat -c '%U' "$LILA_REPO_DIR" 2>/dev/null || true)"
  if [[ -z "$owner" || "$owner" == "UNKNOWN" ]]; then
    return 1
  fi
  if id -u "$owner" >/dev/null 2>&1; then
    printf '%s' "$owner"
    return 0
  fi
  return 1
}

resolve_effective_deploy_user() {
  local configured repo_owner
  configured="$(printf '%s' "$DEPLOY_USER" | xargs)"
  if [[ -n "$configured" ]]; then
    if id -u "$configured" >/dev/null 2>&1; then
      EFFECTIVE_DEPLOY_USER="$configured"
      return 0
    fi
    echo "[deploy] WARN: DEPLOY_USER '$configured' does not exist"
  fi

  repo_owner="$(resolve_repo_owner_user || true)"
  if [[ -n "$repo_owner" ]]; then
    EFFECTIVE_DEPLOY_USER="$repo_owner"
    return 0
  fi

  EFFECTIVE_DEPLOY_USER=""
  return 0
}

resolve_effective_deploy_user

echo "[deploy] repo: $LILA_REPO_DIR"
echo "[deploy] backend service: $BACKEND_SERVICE"
if [[ -n "$EFFECTIVE_DEPLOY_USER" ]]; then
  echo "[deploy] deploy user: $EFFECTIVE_DEPLOY_USER"
else
  echo "[deploy] deploy user: current user ($(id -un))"
fi
echo "[deploy] lock: $DEPLOY_LOCK_FILE"

mkdir -p "$(dirname "$DEPLOY_LOCK_FILE")"
exec 9>"$DEPLOY_LOCK_FILE"
if ! flock -n 9; then
  CURRENT_PID="$(cat "$DEPLOY_LOCK_FILE" 2>/dev/null || true)"
  echo "[deploy] ERROR: deploy lock already held (pid=${CURRENT_PID:-unknown})"
  exit 99
fi
echo "$$" >"$DEPLOY_LOCK_FILE"

on_exit() {
  local code="$?"
  trap - EXIT

  rm -f "$DEPLOY_LOCK_FILE" >/dev/null 2>&1 || true

  # When we stop the backend service, a failure mid-deploy can leave the server down.
  # Best-effort: try to bring the service back if it was active when we started.
  if [[ "$code" != "0" && "$SERVICE_WAS_ACTIVE" == "1" && "$SERVICE_STOPPED" == "1" ]]; then
    echo "[deploy] WARN: deploy failed; attempting to restart backend service: $BACKEND_SERVICE"
    systemctl start "$BACKEND_SERVICE" || true
    systemctl --no-pager --full status "$BACKEND_SERVICE" || true
  fi

  exit "$code"
}
trap on_exit EXIT

run_as_deploy_user() {
  local current_user
  current_user="$(id -un)"

  if [[ -z "$EFFECTIVE_DEPLOY_USER" || "$EFFECTIVE_DEPLOY_USER" == "$current_user" ]]; then
    "$@"
    return
  fi

  if [[ "$(id -u)" -ne 0 ]]; then
    echo "[deploy] WARN: cannot switch to '$EFFECTIVE_DEPLOY_USER' without root privileges; running as '$current_user'"
    "$@"
    return
  fi

  # shellcheck disable=SC2016
  runuser -u "$EFFECTIVE_DEPLOY_USER" -- "$@"
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

cleanup_runtime_generated_changes() {
  # Runtime mirrors can dirty the worktree and block `git pull --ff-only`.
  # These paths are generated and safe to restore/clean before deploy.
  local restore_paths=(
    "backend/data/taverne-categories"
  )

  for p in "${restore_paths[@]}"; do
    if git rev-parse --verify HEAD >/dev/null 2>&1; then
      git restore --worktree -- "$p" >/dev/null 2>&1 || true
    fi
  done

  git clean -fd -- backend/data/client-updates/uploads >/dev/null 2>&1 || true
}

cd "$LILA_REPO_DIR"

echo "[deploy] cleanup runtime-generated git changes"
cleanup_runtime_generated_changes

echo "[deploy] git pull --ff-only"
retry 3 3 run_as_deploy_user git pull --ff-only

echo "[deploy] stopping systemd service before npm ci/build (avoid breaking live Node by rewriting node_modules/dist)"
if systemctl is-active --quiet "$BACKEND_SERVICE"; then
  SERVICE_WAS_ACTIVE=1
  systemctl stop "$BACKEND_SERVICE" || true
  SERVICE_STOPPED=1
fi

echo "[deploy] backend: npm ci/build/migrations"
retry 2 5 run_as_deploy_user bash -lc "cd \"$LILA_REPO_DIR/backend\" && npm ci && npm run build && npm run migration:run"

echo "[deploy] starting systemd service: $BACKEND_SERVICE"
systemctl start "$BACKEND_SERVICE"
systemctl --no-pager --full status "$BACKEND_SERVICE" || true

echo "[deploy] done"

#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
backend_dir="$repo_root/backend"
log_dir="$repo_root/log"
mkdir -p "$log_dir"

timestamp="$(date +%Y%m%d-%H%M%S)"
backend_log="$log_dir/backend-local-wsl-$timestamp.log"
backend_pid_file="$log_dir/backend-local-wsl.pid"

configuration="Debug"
start_client="1"
port="${PORT:-3001}"

usage() {
  cat <<'EOF'
Usage: ./run-local-wsl.sh [--port 3001] [--no-client] [--configuration Debug|Release] [--stop]

Lance Redis + backend NestJS dans WSL, puis (optionnel) lance le client WPF Windows en local (127.0.0.1:PORT).

Notes:
- Le backend reste en arrière-plan; le script "tail" les logs.
- Logs backend: ./log/backend-local-wsl-YYYYMMDD-HHMMSS.log
EOF
}

stop_backend() {
  if [[ -f "$backend_pid_file" ]]; then
    pid="$(cat "$backend_pid_file" 2>/dev/null || true)"
    if [[ -n "$pid" ]]; then
      echo "[wsl] backend: stopping pid=$pid"
      kill "$pid" 2>/dev/null || true
    fi
    rm -f "$backend_pid_file" || true
  else
    echo "[wsl] backend: no pid file ($backend_pid_file)"
  fi
}

kill_listeners_on_port() {
  local port="$1"

  # ss output example:
  # LISTEN ... users:(("node",pid=1234,fd=23))
  local pids
  pids="$(ss -lntpH 2>/dev/null | awk -v p=":$port" '$4 ~ p {print}' | sed -n 's/.*pid=\\([0-9][0-9]*\\).*/\\1/p' | sort -u)"
  if [[ -z "${pids:-}" ]]; then
    return 0
  fi

  echo "[wsl] port $port: listeners detected -> attempting cleanup"
  local pid cmdline killed_any="0"
  for pid in $pids; do
    if [[ ! -r "/proc/$pid/cmdline" ]]; then
      continue
    fi
    cmdline="$(tr '\0' ' ' <"/proc/$pid/cmdline" 2>/dev/null || true)"
    # Safety: only kill processes that look like our NestJS backend.
    if echo "$cmdline" | grep -qiE 'node|nest|ts-node|npm'; then
      if echo "$cmdline" | grep -qiE "$(printf '%s' "$backend_dir" | sed 's/[.[\\*^$()+?{|]/\\&/g')|@nestjs/cli|nest\.js|dist/main|src/main|start:dev"; then
        echo "[wsl] port $port: killing pid=$pid ($cmdline)"
        kill "$pid" 2>/dev/null || true
        killed_any="1"
      else
        echo "[wsl] port $port: pid=$pid looks unrelated, skip ($cmdline)"
      fi
    else
      echo "[wsl] port $port: pid=$pid looks unrelated, skip ($cmdline)"
    fi
  done

  if [[ "$killed_any" == "1" ]]; then
    # Give them a moment to exit, then force if needed.
    for _ in $(seq 1 40); do
      if ! ss -lntH 2>/dev/null | awk -v p=":$port" '$4 ~ p {found=1} END{exit found?0:1}'; then
        return 0
      fi
      sleep 0.25
    done

    # Force-kill remaining matching pids.
    pids="$(ss -lntpH 2>/dev/null | awk -v p=":$port" '$4 ~ p {print}' | sed -n 's/.*pid=\\([0-9][0-9]*\\).*/\\1/p' | sort -u)"
    for pid in $pids; do
      if [[ -r "/proc/$pid/cmdline" ]]; then
        cmdline="$(tr '\0' ' ' <"/proc/$pid/cmdline" 2>/dev/null || true)"
        if echo "$cmdline" | grep -qiE "$(printf '%s' "$backend_dir" | sed 's/[.[\\*^$()+?{|]/\\&/g')|@nestjs/cli|nest\.js|dist/main|src/main|start:dev"; then
          echo "[wsl] port $port: force killing pid=$pid"
          kill -9 "$pid" 2>/dev/null || true
        fi
      fi
    done
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --port)
      port="${2:-}"
      shift 2
      ;;
    --configuration)
      configuration="${2:-}"
      shift 2
      ;;
    --no-client)
      start_client="0"
      shift 1
      ;;
    --stop)
      stop_backend
      exit 0
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Argument inconnu: $1" >&2
      usage
      exit 2
      ;;
  esac
done

if [[ ! -d "$backend_dir" ]]; then
  echo "Backend introuvable: $backend_dir" >&2
  exit 1
fi

start_redis() {
  if command -v redis-cli >/dev/null 2>&1; then
    if redis-cli ping 2>/dev/null | grep -qi '^PONG$'; then
      echo "[wsl] redis:   ready"
      return 0
    fi
  fi

  echo "[wsl] redis:   starting..."
  if command -v sudo >/dev/null 2>&1; then
    sudo -n service redis-server start >/dev/null 2>&1 || true
    sudo -n systemctl start redis-server >/dev/null 2>&1 || true
  fi

  for _ in $(seq 1 60); do
    if command -v redis-cli >/dev/null 2>&1; then
      if redis-cli ping 2>/dev/null | grep -qi '^PONG$'; then
        echo "[wsl] redis:   ready"
        return 0
      fi
    fi
    sleep 0.25
  done

  echo "[wsl] redis:   NOT ready (installe redis-server + redis-tools, ou démarre-le manuellement)" >&2
  return 1
}

wait_tcp() {
  local host="$1"
  local port="$2"
  local seconds="$3"
  local deadline
  deadline="$(($(date +%s) + seconds))"
  while [[ "$(date +%s)" -lt "$deadline" ]]; do
    (echo >/dev/tcp/"$host"/"$port") >/dev/null 2>&1 && return 0
    sleep 0.25
  done
  return 1
}

echo "[wsl] repo:    $repo_root"
echo "[wsl] backend: $backend_dir"
echo "[wsl] log:     $backend_log"

echo "[wsl] cleanup: stopping previous backend if any"
stop_backend >/dev/null 2>&1 || true
kill_listeners_on_port "$port" || true

start_redis

cd "$backend_dir"

if [[ ! -d node_modules ]]; then
  echo "[wsl] npm:     node_modules absent -> npm ci"
  npm ci
fi

export NODE_ENV="${NODE_ENV:-development}"
export PORT="$port"

# DB defaults: si MySQL tourne sur Windows (WAMP), WSL peut généralement y accéder via 127.0.0.1:3306
# (localhost forwarding WSL). Si ça ne marche pas, définir DB_HOST manuellement.
export DB_HOST="${DB_HOST:-127.0.0.1}"
export DB_PORT="${DB_PORT:-3306}"
export DB_USER="${DB_USER:-root}"
export DB_PASSWORD="${DB_PASSWORD:-}"
export DB_NAME="${DB_NAME:-le_monde_de_lila}"

# Redis: backend dans WSL -> loopback WSL.
export GAME_ENGINE_STATE_REDIS_URL="${GAME_ENGINE_STATE_REDIS_URL:-redis://127.0.0.1:6379/0}"
export SESSION_STORE_REDIS_URL="${SESSION_STORE_REDIS_URL:-redis://127.0.0.1:6379/1}"
export NOTIFICATION_REDIS_URL="${NOTIFICATION_REDIS_URL:-redis://127.0.0.1:6379/1}"
export PRESENCE_REDIS_URL="${PRESENCE_REDIS_URL:-redis://127.0.0.1:6379/1}"

echo "[wsl] env:     PORT=$PORT"
echo "[wsl] env:     DB_HOST=$DB_HOST DB_PORT=$DB_PORT DB_USER=$DB_USER DB_NAME=$DB_NAME"

echo "[wsl] db:      running migrations..."
npm run migration:run:dev >>"$backend_log" 2>&1

echo "[wsl] backend: starting (watch, background)..."
nohup npm run start:dev >>"$backend_log" 2>&1 &
backend_pid="$!"
echo "$backend_pid" >"$backend_pid_file"
echo "[wsl] backend: pid=$backend_pid"

echo "[wsl] backend: waiting for 127.0.0.1:$PORT..."
if ! wait_tcp "127.0.0.1" "$PORT" 120; then
  echo "[wsl] backend: NOT listening on 127.0.0.1:$PORT" >&2
  echo "[wsl] backend: log tail:" >&2
  tail -n 120 "$backend_log" >&2 || true
  exit 1
fi
echo "[wsl] backend: ready (tcp ok)"
echo "[wsl] backend: http/ws sur http://127.0.0.1:$PORT (accessible depuis Windows via localhost forwarding WSL)"

if [[ "$start_client" == "1" ]]; then
  client_ps1="$repo_root/client-win/run-client.ps1"
  if command -v wslpath >/dev/null 2>&1; then
    client_ps1_win="$(wslpath -w "$client_ps1")"
  else
    client_ps1_win="$client_ps1"
  fi

  echo "[wsl] client:  starting (Windows) configuration=$configuration"
  # -Watch:$false: évite dotnet watch par défaut dans le script client.
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$client_ps1_win" -Configuration "$configuration" -Watch:$false -Local -BackendPort "$PORT" -StartBackend:$false >/dev/null 2>&1 || true
fi

echo "[wsl] tail:    Ctrl+C pour arrêter le tail (le backend continue)."
echo "[wsl] stop:    ./run-local-wsl.sh --stop"
tail -n 80 -f "$backend_log"

#!/usr/bin/env bash

REDIS_CONFIG_FILE="${REDIS_CONFIG_FILE:-/etc/redis/redis.conf}"

redis_local_password() {
  [[ -r "$REDIS_CONFIG_FILE" ]] || return 1
  python3 - "$REDIS_CONFIG_FILE" <<'PY'
import shlex
import sys

password = None
with open(sys.argv[1], encoding="utf-8") as stream:
    for raw_line in stream:
        try:
            fields = shlex.split(raw_line, comments=True, posix=True)
        except ValueError:
            continue
        if len(fields) >= 2 and fields[0].lower() == "requirepass":
            password = fields[1]

if not password:
    raise SystemExit(1)
sys.stdout.write(password)
PY
}

backend_local_redis_auth_matches() {
  local password
  if ! password="$(redis_local_password)"; then
    # Redis local n'utilise pas requirepass, ou sa configuration n'est pas
    # lisible : il n'y a rien à synchroniser automatiquement.
    return 0
  fi

  LILA_LOCAL_REDIS_PASSWORD="$password" python3 - "$BACKEND_ENV_FILE" <<'PY'
import os
import re
import sys
from urllib.parse import unquote, urlsplit

local_hosts = {"127.0.0.1", "localhost", "::1"}
expected = os.environ["LILA_LOCAL_REDIS_PASSWORD"]
found_local = False
valid = True

with open(sys.argv[1], encoding="utf-8") as stream:
    for raw_line in stream:
        match = re.match(r"^([A-Z][A-Z0-9_]*_REDIS_URL)=(.*)$", raw_line.rstrip("\n"))
        if not match:
            continue
        value = match.group(2).strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        try:
            parsed = urlsplit(value)
        except ValueError:
            continue
        if parsed.scheme not in {"redis", "rediss"} or parsed.hostname not in local_hosts:
            continue
        found_local = True
        if parsed.password is None or unquote(parsed.password) != expected:
            valid = False

raise SystemExit(0 if not found_local or valid else 1)
PY
}

configure_backend_local_redis_auth() {
  require_command python3
  require_file "$BACKEND_ENV_FILE" "Fichier d'environnement backend absent"

  local password
  if ! password="$(redis_local_password)"; then
    return 0
  fi
  if backend_local_redis_auth_matches; then
    return 0
  fi

  local runtime_group environment_temp backup_file status
  runtime_group="$(id -gn "$BACKEND_RUNTIME_USER")"
  environment_temp="$(mktemp "$(dirname "$BACKEND_ENV_FILE")/.backend.env.XXXXXX")"
  backup_file="${BACKEND_ENV_FILE}.pre-local-redis-auth"
  if [[ ! -f "$backup_file" ]]; then
    cp -a "$BACKEND_ENV_FILE" "$backup_file"
    chmod 0600 "$backup_file"
  fi

  if LILA_LOCAL_REDIS_PASSWORD="$password" python3 - "$BACKEND_ENV_FILE" "$environment_temp" <<'PY'
import os
import re
import sys
from urllib.parse import quote, unquote, urlsplit, urlunsplit

source, destination = sys.argv[1:]
password = os.environ["LILA_LOCAL_REDIS_PASSWORD"]
local_hosts = {"127.0.0.1", "localhost", "::1"}
changed = 0
output = []

with open(source, encoding="utf-8") as stream:
    for raw_line in stream:
        line = raw_line.rstrip("\n")
        match = re.match(r"^([A-Z][A-Z0-9_]*_REDIS_URL)=(.*)$", line)
        if not match:
            output.append(line)
            continue

        value = match.group(2).strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        try:
            parsed = urlsplit(value)
            port = parsed.port
        except ValueError:
            output.append(line)
            continue
        if parsed.scheme not in {"redis", "rediss"} or parsed.hostname not in local_hosts:
            output.append(line)
            continue

        username = "" if parsed.username is None else quote(unquote(parsed.username), safe="")
        encoded_password = quote(password, safe="")
        host = f"[{parsed.hostname}]" if ":" in parsed.hostname else parsed.hostname
        authority = f"{username}:{encoded_password}@{host}"
        if port is not None:
            authority += f":{port}"
        secured = urlunsplit((parsed.scheme, authority, parsed.path, parsed.query, parsed.fragment))
        output.append(f"{match.group(1)}={secured}")
        changed += 1

if changed == 0:
    raise SystemExit(2)
with open(destination, "w", encoding="utf-8", newline="\n") as stream:
    stream.write("\n".join(output) + "\n")
PY
  then
    status=0
  else
    status=$?
  fi

  if [[ "$status" -eq 2 ]]; then
    rm -f "$environment_temp"
    return 0
  fi
  if [[ "$status" -ne 0 ]]; then
    rm -f "$environment_temp"
    die "Impossible de sécuriser les URL Redis locales dans $BACKEND_ENV_FILE."
  fi

  install -m 0640 -o root -g "$runtime_group" "$environment_temp" "$BACKEND_ENV_FILE"
  rm -f "$environment_temp"
  unset password
  log "Authentification Redis locale synchronisée dans l'environnement backend (secret masqué)."
}

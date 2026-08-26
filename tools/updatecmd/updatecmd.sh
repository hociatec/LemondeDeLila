#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

usage() {
  cat <<'EOF'
Usage: sudo ./updatecmd [all|backend|wx|doctor|status|bootstrap] [options]

  all       construit/déploie le backend puis construit/publie le client WX
  backend   construit, teste, migre et déploie uniquement le backend
  wx        cross-compile, signe et publie uniquement le client WX Windows
  doctor    contrôle la configuration sans modifier le serveur
  status    affiche la release backend active et la dernière release WX
  bootstrap installe les prérequis et les unités systemd (Debian/Ubuntu)

Options:
  --source CHEMIN  source locale à déployer (défaut: dossier contenant updatecmd)
  --force          reconstruit même si cette source a déjà été traitée
EOF
}

COMMAND="all"
FORCE=0
SOURCE_ROOT="${UPDATECMD_SOURCE_DIR:-}"
if [[ $# -gt 0 && "$1" != --* ]]; then
  COMMAND="$1"
  shift
fi
while [[ $# -gt 0 ]]; do
  case "$1" in
    --source)
      [[ $# -ge 2 ]] || die "Valeur absente après --source."
      SOURCE_ROOT="$2"
      shift 2
      ;;
    --force)
      # Consommé par les fonctions chargées depuis lib/backend.sh et lib/wx.sh.
      # shellcheck disable=SC2034
      FORCE=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *) die "Option inconnue: $1" ;;
  esac
done

case "$COMMAND" in
  bootstrap)
    if [[ -n "$SOURCE_ROOT" ]]; then
      exec "$SCRIPT_DIR/bootstrap.sh" --source "$SOURCE_ROOT"
    fi
    exec "$SCRIPT_DIR/bootstrap.sh"
    ;;
  all|backend|wx|doctor|status) ;;
  *) usage; die "Commande inconnue: $COMMAND" ;;
esac

require_root
load_updatecmd_config
# shellcheck source=lib/redis.sh
source "$SCRIPT_DIR/lib/redis.sh"

doctor() {
  local failed=0 command
  for command in bash curl flock jq node npm rsync sha256sum; do
    if command -v "$command" >/dev/null 2>&1; then
      log "OK commande: $command"
    else
      warn "Commande absente: $command"
      failed=1
    fi
  done
  [[ -f "$BACKEND_ENV_FILE" ]] || { warn "Environnement backend absent: $BACKEND_ENV_FILE"; failed=1; }
  if [[ -f "$BACKEND_ENV_FILE" ]] && ! backend_local_redis_auth_matches; then
    warn "Les URL Redis locales du backend ne correspondent pas au mot de passe de Redis."
    warn "La prochaine commande 'sudo updatecmd backend' les réparera automatiquement."
    failed=1
  fi
  if systemctl is-active --quiet "$BACKEND_SERVICE"; then
    curl --fail --silent --max-time 3 "$BACKEND_READINESS_URL" \
      | jq -e '.status == "ok" and .details.database.status == "up" and .details.redis.status == "up"' \
        >/dev/null \
      || { warn "Le backend actif n'est pas prêt (base de données ou Redis indisponible)."; failed=1; }
  fi
  if [[ "$COMMAND" == "doctor" ]]; then
    for command in cmake ninja x86_64-w64-mingw32-g++-posix \
      x86_64-w64-mingw32-objdump makensis osslsigncode zip openssl; do
      if command -v "$command" >/dev/null 2>&1; then
        log "OK commande WX: $command"
      else
        warn "Commande WX absente: $command"
        failed=1
      fi
    done
    for secret in "$WX_UPLOAD_TOKEN_FILE" "$WX_MANIFEST_PRIVATE_KEY" "$WX_CODESIGN_PFX" "$WX_CODESIGN_PASSWORD_FILE"; do
      [[ -s "$secret" ]] || { warn "Secret WX absent ou vide: $secret"; failed=1; }
    done
    if [[ -s "$WX_MANIFEST_PRIVATE_KEY" ]]; then
      openssl pkey -in "$WX_MANIFEST_PRIVATE_KEY" -check -noout >/dev/null 2>&1 \
        || { warn "Clé privée de manifeste WX invalide."; failed=1; }
      local configured_public_path private_public_hash configured_public_hash
      configured_public_path="$(sed -n 's/^CLIENT_WX_SIGNATURE_PUBLIC_KEY_PATH=//p' "$BACKEND_ENV_FILE" 2>/dev/null | tail -n 1)"
      configured_public_path="${configured_public_path%\"}"
      configured_public_path="${configured_public_path#\"}"
      if [[ -n "$configured_public_path" && -s "$configured_public_path" ]]; then
        private_public_hash="$(openssl pkey -in "$WX_MANIFEST_PRIVATE_KEY" -pubout -outform DER 2>/dev/null | sha256sum | awk '{print $1}')"
        configured_public_hash="$(openssl pkey -pubin -in "$configured_public_path" -pubout -outform DER 2>/dev/null | sha256sum | awk '{print $1}')"
        [[ "$private_public_hash" == "$configured_public_hash" ]] \
          || { warn "La clé publique du backend ne correspond pas à la clé privée de manifeste."; failed=1; }
      fi
    fi
    if [[ -s "$WX_CODESIGN_PFX" && -s "$WX_CODESIGN_PASSWORD_FILE" ]]; then
      local actual_signer
      if ! actual_signer="$(openssl pkcs12 -in "$WX_CODESIGN_PFX" \
        -passin "file:$WX_CODESIGN_PASSWORD_FILE" -clcerts -nokeys 2>/dev/null \
        | openssl x509 -outform DER 2>/dev/null | sha256sum | awk '{print tolower($1)}')"; then
        warn "PFX Authenticode ou mot de passe invalide."
        failed=1
      elif [[ -n "$WX_EXPECTED_SIGNER_SHA256" \
        && "$actual_signer" != "${WX_EXPECTED_SIGNER_SHA256,,}" ]]; then
        warn "Le certificat PFX ne correspond pas à l'empreinte épinglée par les clients."
        failed=1
      fi
    fi
  fi
  return "$failed"
}

if [[ "$COMMAND" == "doctor" ]]; then
  doctor
  log "Configuration updatecmd valide."
  exit 0
fi

if [[ "$COMMAND" == "status" ]]; then
  current="$(readlink -f "$INSTALL_ROOT/current" 2>/dev/null || true)"
  log "Backend actif: ${current:-aucun}"
  if [[ -s "$WX_UPLOAD_TOKEN_FILE" ]]; then
    token="$(tr -d '\r\n' <"$WX_UPLOAD_TOKEN_FILE")"
    curl --fail --silent --show-error \
      -H "x-client-updates-upload-token: $token" \
      "${WX_API_BASE%/}/api/ci/client-wx-updates/status" | jq .
  else
    warn "Token WX absent; statut WX indisponible."
  fi
  exit 0
fi

[[ -n "$SOURCE_ROOT" ]] || die "Source locale indéterminée; utilisez --source CHEMIN."
SOURCE_ROOT="$(cd "$SOURCE_ROOT" && pwd -P)"
require_file "$SOURCE_ROOT/backend/package-lock.json" "Source backend invalide"
require_file "$SOURCE_ROOT/client-wx/CMakeLists.txt" "Source client WX invalide"
require_command flock
require_command rsync
require_command sha256sum

mkdir -p "$(dirname "$LOCK_FILE")" "$STATE_ROOT" "$CACHE_ROOT" "$INSTALL_ROOT/releases"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  die "Un autre updatecmd est déjà en cours."
fi
printf '%s\n' "$$" >&9

if [[ "$COMMAND" == "backend" || "$COMMAND" == "all" ]]; then
  configure_backend_local_redis_auth
fi

RUN_DIR="$(mktemp -d "$CACHE_ROOT/run.XXXXXX")"
SNAPSHOT_DIR="$RUN_DIR/source"
cleanup_run() {
  if [[ "$RUN_DIR" == "$CACHE_ROOT/run."* && -d "$RUN_DIR" ]]; then
    rm -rf --one-file-system "$RUN_DIR"
  fi
}
trap cleanup_run EXIT INT TERM

log "Création d'un instantané cohérent depuis $SOURCE_ROOT (aucun appel Git)."
create_source_snapshot "$SOURCE_ROOT" "$SNAPSHOT_DIR"
BACKEND_SOURCE_ID="$(tree_digest "$SNAPSHOT_DIR/backend")"
WX_SOURCE_ID="$({
  printf 'client-wx %s\n' "$(tree_digest "$SNAPSHOT_DIR/client-wx")"
  printf 'ws-events %s\n' "$(sha256_file "$SNAPSHOT_DIR/backend/src/realtime/infrastructure/presentation/ws/ws-events.ts")"
  printf 'fields %s\n' "$(sha256_file "$SNAPSHOT_DIR/backend/contracts/client-wx-fields.json")"
  if [[ -d "$SNAPSHOT_DIR/client-win" ]]; then
    printf 'client-win %s\n' "$(tree_digest "$SNAPSHOT_DIR/client-win")"
  fi
} | sha256sum | awk '{print tolower($1)}')"
[[ "$BACKEND_SOURCE_ID" =~ ^[a-f0-9]{64}$ ]] || die "Identifiant de source backend invalide."
[[ "$WX_SOURCE_ID" =~ ^[a-f0-9]{64}$ ]] || die "Identifiant de source WX invalide."
log "Identifiant backend: $BACKEND_SOURCE_ID"
log "Identifiant client WX: $WX_SOURCE_ID"

if [[ "$COMMAND" == "backend" || "$COMMAND" == "all" ]]; then
  # shellcheck source=lib/backend.sh
  source "$SCRIPT_DIR/lib/backend.sh"
  deploy_backend
fi

if [[ "$COMMAND" == "wx" || "$COMMAND" == "all" ]]; then
  # shellcheck source=lib/wx.sh
  source "$SCRIPT_DIR/lib/wx.sh"
  build_and_publish_wx
fi

log "Terminé avec succès."

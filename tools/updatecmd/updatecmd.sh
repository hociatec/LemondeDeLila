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
  --artifact FICHIER archive backend déjà construite et validée par la CI
  --artifact-sha256 SHA256 empreinte attendue de l'archive backend
  --force          reconstruit même si cette source a déjà été traitée
EOF
}

COMMAND="all"
FORCE=0
SOURCE_ROOT="${UPDATECMD_SOURCE_DIR:-}"
BACKEND_ARTIFACT=""
BACKEND_ARTIFACT_SHA256=""
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
    --artifact)
      [[ $# -ge 2 ]] || die "Valeur absente après --artifact."
      BACKEND_ARTIFACT="$2"
      shift 2
      ;;
    --artifact-sha256)
      [[ $# -ge 2 ]] || die "Valeur absente après --artifact-sha256."
      BACKEND_ARTIFACT_SHA256="${2,,}"
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
      -H "x-client-wx-updates-upload-token: $token" \
      "${WX_API_BASE%/}/api/ci/client-wx-updates/status" | jq .
  else
    warn "Token WX absent; statut WX indisponible."
  fi
  exit 0
fi

require_command flock
require_command rsync
require_command sha256sum
BACKEND_ARTIFACT_MODE=0
if [[ -n "$BACKEND_ARTIFACT" ]]; then
  [[ "$COMMAND" == "backend" ]] \
    || die "--artifact est réservé à la commande backend."
  [[ -z "$SOURCE_ROOT" ]] \
    || die "--source et --artifact sont mutuellement exclusifs."
  [[ "$BACKEND_ARTIFACT_SHA256" =~ ^[a-f0-9]{64}$ ]] \
    || die "--artifact-sha256 doit contenir 64 caractères hexadécimaux."
  require_file "$BACKEND_ARTIFACT" "Archive backend absente"
  require_command tar
  require_command jq
  actual_artifact_sha="$(sha256_file "$BACKEND_ARTIFACT")"
  [[ "$actual_artifact_sha" == "$BACKEND_ARTIFACT_SHA256" ]] \
    || die "Empreinte de l'archive backend invalide."
  BACKEND_ARTIFACT="$(cd "$(dirname "$BACKEND_ARTIFACT")" && pwd -P)/$(basename "$BACKEND_ARTIFACT")"
  BACKEND_ARTIFACT_MODE=1
else
  [[ -n "$SOURCE_ROOT" ]] || die "Source locale indéterminée; utilisez --source CHEMIN."
  SOURCE_ROOT="$(cd "$SOURCE_ROOT" && pwd -P)"
  require_file "$SOURCE_ROOT/backend/package-lock.json" "Source backend invalide"
  if [[ "$COMMAND" == "all" || "$COMMAND" == "wx" ]]; then
    require_file "$SOURCE_ROOT/client-wx/CMakeLists.txt" "Source client WX invalide"
  fi
  require_command git
  assert_immutable_git_source "$SOURCE_ROOT"
fi

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

if [[ "$BACKEND_ARTIFACT_MODE" == "1" ]]; then
  mkdir -p "$SNAPSHOT_DIR"
  if tar -tzf "$BACKEND_ARTIFACT" \
    | grep -Eq '(^/|(^|/)\.\.(/|$))'; then
    die "Archive backend contenant un chemin dangereux."
  fi
  tar -xzf "$BACKEND_ARTIFACT" -C "$SNAPSHOT_DIR" --no-same-owner --no-same-permissions
  require_file "$SNAPSHOT_DIR/.backend-artifact.json" "Manifeste d'artefact absent"
  require_file "$SNAPSHOT_DIR/backend/dist/main.js" "Build backend absent de l'artefact"
  [[ -d "$SNAPSHOT_DIR/backend/node_modules" ]] \
    || die "Dépendances de production absentes de l'artefact."
  artifact_schema="$(jq -er '.schemaVersion' "$SNAPSHOT_DIR/.backend-artifact.json")"
  [[ "$artifact_schema" == "1" ]] || die "Version de manifeste d'artefact inconnue."
  SOURCE_GIT_SHA="$(jq -er '.sourceGitSha' "$SNAPSHOT_DIR/.backend-artifact.json")"
  [[ "$SOURCE_GIT_SHA" =~ ^[a-f0-9]{40,64}$ ]] || die "SHA source de l'artefact invalide."
  if [[ -n "${GITHUB_SHA:-}" && "$SOURCE_GIT_SHA" != "$GITHUB_SHA" ]]; then
    die "L'artefact ne correspond pas au SHA demandé par GitHub Actions."
  fi
  BACKEND_SOURCE_ID="$BACKEND_ARTIFACT_SHA256"
  WX_SOURCE_ID=""
  log "Artefact backend vérifié: $BACKEND_SOURCE_ID (source $SOURCE_GIT_SHA)."
else
  log "Création d'un instantané cohérent du commit $SOURCE_GIT_SHA."
  create_source_snapshot "$SOURCE_ROOT" "$SNAPSHOT_DIR"
  BACKEND_SOURCE_ID="$(tree_digest "$SNAPSHOT_DIR/backend")"
  WX_SOURCE_ID="$({
    printf 'client-wx %s\n' "$(tree_digest "$SNAPSHOT_DIR/client-wx")"
    printf 'ws-events %s\n' "$(sha256_file "$SNAPSHOT_DIR/backend/src/platform/realtime/infrastructure/presentation/ws/ws-events.ts")"
    printf 'fields %s\n' "$(sha256_file "$SNAPSHOT_DIR/backend/contracts/client-wx-fields.json")"
  } | sha256sum | awk '{print tolower($1)}')"
fi
[[ "$BACKEND_SOURCE_ID" =~ ^[a-f0-9]{64}$ ]] || die "Identifiant de source backend invalide."
if [[ "$COMMAND" == "all" || "$COMMAND" == "wx" ]]; then
  [[ "$WX_SOURCE_ID" =~ ^[a-f0-9]{64}$ ]] || die "Identifiant de source WX invalide."
fi
log "Identifiant backend: $BACKEND_SOURCE_ID"
if [[ -n "$WX_SOURCE_ID" ]]; then
  log "Identifiant client WX: $WX_SOURCE_ID"
fi

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

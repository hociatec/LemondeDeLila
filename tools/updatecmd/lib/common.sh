#!/usr/bin/env bash

log() {
  printf '[updatecmd] %s\n' "$*"
}

warn() {
  printf '[updatecmd] ATTENTION: %s\n' "$*" >&2
}

die() {
  printf '[updatecmd] ERREUR: %s\n' "$*" >&2
  exit 1
}

require_root() {
  [[ "$(id -u)" -eq 0 ]] || die "Cette commande doit être exécutée avec sudo."
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "Commande requise absente: $1 (lancez: sudo ./updatecmd bootstrap)"
}

require_file() {
  [[ -f "$1" ]] || die "$2: $1"
}

require_nonempty_file() {
  [[ -s "$1" ]] || die "$2: $1"
}

assert_safe_root() {
  local value="$1"
  local label="$2"
  [[ -n "$value" && "$value" == /* && "$value" != "/" ]] || die "$label doit être un chemin absolu non racine: $value"
}

run_as() {
  local user="$1"
  shift
  if [[ "$(id -un)" == "$user" ]]; then
    "$@"
  else
    runuser -u "$user" -- "$@"
  fi
}

retry() {
  local attempts="$1"
  local delay_seconds="$2"
  shift 2
  local attempt=1
  until "$@"; do
    if (( attempt >= attempts )); then
      return 1
    fi
    warn "Échec de '$*' (tentative $attempt/$attempts), nouvel essai dans ${delay_seconds}s."
    sleep "$delay_seconds"
    attempt=$((attempt + 1))
  done
}

atomic_symlink() {
  local target="$1"
  local link="$2"
  local temporary="${link}.new.$$"
  ln -s "$target" "$temporary"
  mv -Tf "$temporary" "$link"
}

sha256_file() {
  sha256sum "$1" | awk '{print tolower($1)}'
}

tree_digest() {
  local root="$1"
  (
    cd "$root" || exit 1
    find . -type f -print0 \
      | LC_ALL=C sort -z \
      | xargs -0 -r sha256sum \
      | sha256sum \
      | awk '{print tolower($1)}'
  )
}

assert_immutable_git_source() {
  local source_root="$1"
  [[ -d "$source_root/.git" ]] \
    || die "La source de production doit être un checkout Git versionné: $source_root"
  git -C "$source_root" diff --quiet -- \
    || die "La source contient des modifications non indexées."
  git -C "$source_root" diff --cached --quiet -- \
    || die "La source contient des modifications indexées non commitées."
  [[ -z "$(git -C "$source_root" status --porcelain --untracked-files=normal)" ]] \
    || die "La source contient des fichiers non suivis."
  SOURCE_GIT_SHA="$(git -C "$source_root" rev-parse --verify HEAD)"
  [[ "$SOURCE_GIT_SHA" =~ ^[a-f0-9]{40,64}$ ]] \
    || die "SHA Git de source invalide."
  if [[ -n "${GITHUB_SHA:-}" && "$SOURCE_GIT_SHA" != "$GITHUB_SHA" ]]; then
    die "Le checkout ne correspond pas au SHA demandé par GitHub Actions."
  fi
}

create_source_snapshot() {
  local source_root="$1"
  local destination="$2"
  mkdir -p "$destination"

  rsync -a --delete \
    --exclude '/.git/' \
    --exclude '/node_modules/' \
    --exclude '/dist*/' \
    --exclude '/build/' \
    --exclude '/coverage/' \
    --exclude '/.env' \
    --exclude '/keys/' \
    --exclude '/data/client-wx-updates/' \
    --exclude '/data/sounds/' \
    --exclude '/backend/logs/' \
    --exclude '/client-wx/logs/' \
    "$source_root/backend/" "$destination/backend/"

  rsync -a --delete \
    --exclude '/build/' \
    --exclude '/logs/' \
    "$source_root/client-wx/" "$destination/client-wx/"

}

load_updatecmd_config() {
  local default_config="/etc/lemonde-de-lila/updatecmd.conf"
  UPDATECMD_CONFIG="${UPDATECMD_CONFIG:-$default_config}"
  if [[ -f "$UPDATECMD_CONFIG" ]]; then
    # Ce fichier appartient à root (0600) et contient les chemins/secrets du déploiement.
    # shellcheck source=/dev/null
    source "$UPDATECMD_CONFIG"
  elif [[ "${UPDATECMD_ALLOW_EXAMPLE_CONFIG:-0}" != "1" ]]; then
    die "Configuration absente: $UPDATECMD_CONFIG. Lancez d'abord: sudo ./updatecmd bootstrap"
  fi

  INSTALL_ROOT="${INSTALL_ROOT:-/opt/lemonde-de-lila}"
  STATE_ROOT="${STATE_ROOT:-/var/lib/lemonde-de-lila/updatecmd}"
  CACHE_ROOT="${CACHE_ROOT:-/var/cache/lemonde-de-lila/updatecmd}"
  LOCK_FILE="${LOCK_FILE:-/var/lock/lemonde-de-lila-updatecmd.lock}"
  BUILD_USER="${BUILD_USER:-ubuntu}"
  BACKEND_RUNTIME_USER="${BACKEND_RUNTIME_USER:-$BUILD_USER}"
  BACKEND_SERVICE="${BACKEND_SERVICE:-lila-backend.service}"
  BACKEND_UNIT_FILE="${BACKEND_UNIT_FILE:-/etc/lemonde-de-lila/lila-backend.service}"
  BACKEND_ENV_FILE="${BACKEND_ENV_FILE:-/etc/lemonde-de-lila/backend.env}"
  BACKEND_SHARED_DATA_ROOT="${BACKEND_SHARED_DATA_ROOT:-/var/lib/lemonde-de-lila/backend-data}"
  BACKEND_KEYS_ROOT="${BACKEND_KEYS_ROOT:-/etc/lemonde-de-lila/keys}"
  BACKEND_HEALTH_URL="${BACKEND_HEALTH_URL:-http://127.0.0.1:3001/health/info}"
  BACKEND_READINESS_URL="${BACKEND_READINESS_URL:-http://127.0.0.1:3001/health}"
  BACKEND_TEST_COMMAND="${BACKEND_TEST_COMMAND:-npm run test:transverse}"
  BACKEND_KEEP_RELEASES="${BACKEND_KEEP_RELEASES:-5}"
  WX_API_BASE="${WX_API_BASE:-http://127.0.0.1:3001}"
  WX_PUBLIC_URL="${WX_PUBLIC_URL:-https://api.lilas.hociatec.fr/updates/client-wx/}"
  WX_UPLOAD_TOKEN_FILE="${WX_UPLOAD_TOKEN_FILE:-/etc/lemonde-de-lila/secrets/wx-upload-token}"
  WX_MANIFEST_PRIVATE_KEY="${WX_MANIFEST_PRIVATE_KEY:-/etc/lemonde-de-lila/secrets/wx-update-private.pem}"
  WX_CODESIGN_PFX="${WX_CODESIGN_PFX:-/etc/lemonde-de-lila/secrets/wx-codesign.pfx}"
  WX_CODESIGN_PASSWORD_FILE="${WX_CODESIGN_PASSWORD_FILE:-/etc/lemonde-de-lila/secrets/wx-codesign-password}"
  WX_EXPECTED_SIGNER_SHA256="${WX_EXPECTED_SIGNER_SHA256:-62e99e10aeeaf2445da6763f4524863529ab0e1c9d9af7f5aa0b483e80dabef5}"
  WX_TIMESTAMP_URL="${WX_TIMESTAMP_URL:-http://timestamp.digicert.com}"
  WX_VERSION_MAJOR="${WX_VERSION_MAJOR:-1}"
  WX_VERSION_MINOR="${WX_VERSION_MINOR:-2}"
  WX_MANDATORY="${WX_MANDATORY:-1}"
  WX_MESSAGE="${WX_MESSAGE:-Mise à jour obligatoire du client WX.}"
  WX_VCPKG_ROOT="${WX_VCPKG_ROOT:-$CACHE_ROOT/toolchains/vcpkg}"
  WX_VCPKG_TRIPLET="${WX_VCPKG_TRIPLET:-x64-mingw-lila-dynamic}"
  WX_BASS_ROOT="${WX_BASS_ROOT:-$CACHE_ROOT/toolchains/bass}"
  WX_BUILD_DIR="${WX_BUILD_DIR:-$CACHE_ROOT/client-wx-build}"
  WX_BINARY_CACHE="${WX_BINARY_CACHE:-$CACHE_ROOT/vcpkg-binary-cache}"

  for pair in \
    "$INSTALL_ROOT:INSTALL_ROOT" \
    "$STATE_ROOT:STATE_ROOT" \
    "$CACHE_ROOT:CACHE_ROOT" \
    "$BACKEND_SHARED_DATA_ROOT:BACKEND_SHARED_DATA_ROOT" \
    "$LOCK_FILE:LOCK_FILE"; do
    assert_safe_root "${pair%%:*}" "${pair#*:}"
  done
  id -u "$BUILD_USER" >/dev/null 2>&1 || die "Utilisateur de build absent: $BUILD_USER"
  id -u "$BACKEND_RUNTIME_USER" >/dev/null 2>&1 || die "Utilisateur backend absent: $BACKEND_RUNTIME_USER"
  [[ "$BACKEND_SERVICE" =~ ^[A-Za-z0-9_.@-]+\.service$ ]] || die "BACKEND_SERVICE invalide: $BACKEND_SERVICE"
}

#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

SOURCE_ROOT=""
if [[ "${1:-}" == "--source" ]]; then
  [[ $# -eq 2 ]] || die "Usage: bootstrap.sh [--source CHEMIN]"
  SOURCE_ROOT="$(cd "$2" && pwd -P)"
elif [[ $# -ne 0 ]]; then
  die "Usage: bootstrap.sh [--source CHEMIN]"
fi
if [[ -z "$SOURCE_ROOT" ]]; then
  SOURCE_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd -P)"
fi
require_root
require_file "$SOURCE_ROOT/updatecmd" "Commande updatecmd absente"

SOURCE_OWNER="$(stat -c '%U' "$SOURCE_ROOT")"
id -u "$SOURCE_OWNER" >/dev/null 2>&1 || die "Propriétaire de la source invalide: $SOURCE_OWNER"
log "Installation des prérequis Linux/MinGW (opération unique)."
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends \
  autoconf automake build-essential ca-certificates curl file flex gperf jq \
  libtool mingw-w64-tools nasm ninja-build nsis openssl osslsigncode pkg-config \
  python3 python3-pip python3-venv rsync shellcheck unzip zip \
  g++-mingw-w64-x86-64-posix

mkdir -p /etc/lemonde-de-lila/secrets
chmod 0700 /etc/lemonde-de-lila/secrets
if [[ ! -f /etc/lemonde-de-lila/updatecmd.conf ]]; then
  install -m 0600 "$SOURCE_ROOT/tools/updatecmd/updatecmd.conf.example" /etc/lemonde-de-lila/updatecmd.conf
  sed -i \
    -e "s/^BUILD_USER=.*/BUILD_USER=$SOURCE_OWNER/" \
    -e "s/^BACKEND_RUNTIME_USER=.*/BACKEND_RUNTIME_USER=$SOURCE_OWNER/" \
    /etc/lemonde-de-lila/updatecmd.conf
  log "Configuration créée: /etc/lemonde-de-lila/updatecmd.conf"
fi

UPDATECMD_ALLOW_EXAMPLE_CONFIG=1
export UPDATECMD_ALLOW_EXAMPLE_CONFIG
load_updatecmd_config
# shellcheck source=lib/redis.sh
source "$SCRIPT_DIR/lib/redis.sh"
BACKEND_RUNTIME_GROUP="$(id -gn "$BACKEND_RUNTIME_USER")"
if [[ "$WX_VCPKG_TRIPLET" == "x64-mingw-dynamic" ]]; then
  WX_VCPKG_TRIPLET=x64-mingw-lila-dynamic
  sed -i 's/^WX_VCPKG_TRIPLET=x64-mingw-dynamic$/WX_VCPKG_TRIPLET=x64-mingw-lila-dynamic/' \
    /etc/lemonde-de-lila/updatecmd.conf
fi

mkdir -p "$INSTALL_ROOT/releases" "$STATE_ROOT" "$CACHE_ROOT" \
  /var/lib/lemonde-de-lila/client-updates/client-wx "$BACKEND_SHARED_DATA_ROOT/sounds"
chown -R "$BUILD_USER":"$(id -gn "$BUILD_USER")" "$CACHE_ROOT" "$STATE_ROOT" "$INSTALL_ROOT/releases"
chown -R "$BACKEND_RUNTIME_USER":"$BACKEND_RUNTIME_GROUP" /var/lib/lemonde-de-lila

if [[ -d "$SOURCE_ROOT/backend/data/sounds" ]]; then
  log "Synchronisation initiale des sons vers le stockage persistant."
  rsync -a --ignore-existing "$SOURCE_ROOT/backend/data/sounds/" "$BACKEND_SHARED_DATA_ROOT/sounds/"
  chown -R "$BACKEND_RUNTIME_USER":"$BACKEND_RUNTIME_GROUP" "$BACKEND_SHARED_DATA_ROOT/sounds"
fi

if [[ ! -f "$BACKEND_ENV_FILE" ]]; then
  if [[ -f "$SOURCE_ROOT/backend/.env" ]]; then
    install -m 0640 -o root -g "$BACKEND_RUNTIME_GROUP" "$SOURCE_ROOT/backend/.env" "$BACKEND_ENV_FILE"
    log "Environnement backend copié hors de la source: $BACKEND_ENV_FILE"
  else
    install -m 0640 -o root -g "$BACKEND_RUNTIME_GROUP" /dev/null "$BACKEND_ENV_FILE"
    warn "Complétez le nouveau fichier $BACKEND_ENV_FILE avant le premier déploiement."
  fi
fi

set_env_value() {
  local name="$1"
  local value="$2"
  local environment_temp
  environment_temp="$(mktemp)"
  awk -v prefix="${name}=" 'index($0, prefix) != 1' "$BACKEND_ENV_FILE" >"$environment_temp"
  printf '%s=%s\n' "$name" "$value" >>"$environment_temp"
  install -m 0640 -o root -g "$BACKEND_RUNTIME_GROUP" "$environment_temp" "$BACKEND_ENV_FILE"
  rm -f "$environment_temp"
}

SYSTEMD_UPLOAD_TOKEN="$(systemctl show "$BACKEND_SERVICE" --property=Environment --value 2>/dev/null \
  | tr ' ' '\n' | sed -n 's/^CLIENT_UPDATES_UPLOAD_TOKEN=//p' | tail -n 1)"
CONFIGURED_UPLOAD_TOKEN="$(sed -n 's/^CLIENT_UPDATES_UPLOAD_TOKEN=//p' "$BACKEND_ENV_FILE" | tail -n 1)"
CONFIGURED_UPLOAD_TOKEN="${CONFIGURED_UPLOAD_TOKEN%\"}"
CONFIGURED_UPLOAD_TOKEN="${CONFIGURED_UPLOAD_TOKEN#\"}"
if [[ -z "$CONFIGURED_UPLOAD_TOKEN" && -n "$SYSTEMD_UPLOAD_TOKEN" ]]; then
  CONFIGURED_UPLOAD_TOKEN="$SYSTEMD_UPLOAD_TOKEN"
fi
if [[ ! -s "$WX_UPLOAD_TOKEN_FILE" ]]; then
  if [[ -n "$CONFIGURED_UPLOAD_TOKEN" ]]; then
    printf '%s\n' "$CONFIGURED_UPLOAD_TOKEN" >"$WX_UPLOAD_TOKEN_FILE"
  else
    openssl rand -hex 32 >"$WX_UPLOAD_TOKEN_FILE"
  fi
  chmod 0600 "$WX_UPLOAD_TOKEN_FILE"
fi
WX_BOOTSTRAP_TOKEN="$(tr -d '\r\n' <"$WX_UPLOAD_TOKEN_FILE")"
if [[ -n "$CONFIGURED_UPLOAD_TOKEN" && "$CONFIGURED_UPLOAD_TOKEN" != "$WX_BOOTSTRAP_TOKEN" ]]; then
  die "Le token de $BACKEND_ENV_FILE diffère de $WX_UPLOAD_TOKEN_FILE. Alignez-les explicitement."
fi
set_env_value CLIENT_UPDATES_UPLOAD_TOKEN "$WX_BOOTSTRAP_TOKEN"
set_env_value CLIENT_WX_UPDATES_DIR /var/lib/lemonde-de-lila/client-updates/client-wx
set_env_value CLIENT_WX_UPDATES_META_PATH /var/lib/lemonde-de-lila/client-updates/client-wx-latest.json
set_env_value CLIENT_WX_UPDATES_PUBLIC_URL "$WX_PUBLIC_URL"
set_env_value LMDL_SOUNDS_DIR "$BACKEND_SHARED_DATA_ROOT/sounds"

install -d -m 0750 -o root -g "$BACKEND_RUNTIME_GROUP" "$BACKEND_KEYS_ROOT"
for key_name in jwt-private.pem jwt-public.pem wx-update-public.pem; do
  if [[ -s "$SOURCE_ROOT/backend/keys/$key_name" ]]; then
    install -m 0640 -o root -g "$BACKEND_RUNTIME_GROUP" \
      "$SOURCE_ROOT/backend/keys/$key_name" "$BACKEND_KEYS_ROOT/$key_name"
  fi
done
require_nonempty_file "$BACKEND_KEYS_ROOT/jwt-private.pem" "Clé JWT privée absente"
require_nonempty_file "$BACKEND_KEYS_ROOT/jwt-public.pem" "Clé JWT publique absente"
set_env_value JWT_PRIVATE_KEY_PATH "$BACKEND_KEYS_ROOT/jwt-private.pem"
set_env_value JWT_PUBLIC_KEY_PATH "$BACKEND_KEYS_ROOT/jwt-public.pem"
if [[ -s "$BACKEND_KEYS_ROOT/wx-update-public.pem" ]]; then
  set_env_value CLIENT_WX_SIGNATURE_PUBLIC_KEY_PATH "$BACKEND_KEYS_ROOT/wx-update-public.pem"
fi
chmod 0640 "$BACKEND_ENV_FILE"
chown root:"$BACKEND_RUNTIME_GROUP" "$BACKEND_ENV_FILE"
configure_backend_local_redis_auth

if [[ ! -s "$WX_MANIFEST_PRIVATE_KEY" && -s "$SOURCE_ROOT/backend/keys/wx-update-private.pem" ]]; then
  install -m 0600 "$SOURCE_ROOT/backend/keys/wx-update-private.pem" "$WX_MANIFEST_PRIVATE_KEY"
  log "Clé privée de manifeste WX existante déplacée dans le coffre local."
fi

log "Installation de CMake 3.31 dans un environnement local stable."
CMAKE_VENV="$CACHE_ROOT/toolchains/cmake-venv"
if [[ ! -x "$CMAKE_VENV/bin/cmake" ]]; then
  python3 -m venv "$CMAKE_VENV"
  "$CMAKE_VENV/bin/pip" install --disable-pip-version-check --no-cache-dir 'cmake==3.31.6'
fi
for executable in cmake cpack ctest; do
  ln -sfn "$CMAKE_VENV/bin/$executable" "/usr/local/bin/$executable"
done

VCPKG_VERSION=2026.05.25
VCPKG_SHA256=ae01f7f231082341c911998c698468dc1526bc32bfd28133de009f5e2cf144c8
VCPKG_DOWNLOAD="$CACHE_ROOT/downloads/vcpkg-$VCPKG_VERSION.tar.gz"
mkdir -p "$CACHE_ROOT/downloads" "$WX_VCPKG_ROOT" "$WX_BINARY_CACHE"
if [[ ! -s "$VCPKG_DOWNLOAD" ]]; then
  log "Téléchargement unique de l'archive vcpkg $VCPKG_VERSION (aucun clone Git)."
  curl --fail --location --retry 4 --retry-all-errors \
    "https://github.com/microsoft/vcpkg/archive/refs/tags/$VCPKG_VERSION.tar.gz" \
    -o "$VCPKG_DOWNLOAD"
fi
printf '%s  %s\n' "$VCPKG_SHA256" "$VCPKG_DOWNLOAD" | sha256sum --check
if [[ ! -x "$WX_VCPKG_ROOT/vcpkg" ]]; then
  tar -xzf "$VCPKG_DOWNLOAD" --strip-components=1 -C "$WX_VCPKG_ROOT"
  VCPKG_FORCE_SYSTEM_BINARIES=1 "$WX_VCPKG_ROOT/bootstrap-vcpkg.sh" -disableMetrics
fi
chown -R "$BUILD_USER":"$(id -gn "$BUILD_USER")" "$WX_VCPKG_ROOT" "$WX_BINARY_CACHE"
VCPKG_OVERLAY_ROOT="$CACHE_ROOT/vcpkg-overlays"
mkdir -p "$VCPKG_OVERLAY_ROOT/libwebp"
rsync -a --delete "$WX_VCPKG_ROOT/ports/libwebp/" "$VCPKG_OVERLAY_ROOT/libwebp/"
install -m 0644 "$SOURCE_ROOT/tools/updatecmd/vcpkg-overlays/libwebp-mingw-gcc10-avx2.patch" \
  "$VCPKG_OVERLAY_ROOT/libwebp/libwebp-mingw-gcc10-avx2.patch"
if ! grep -q 'libwebp-mingw-gcc10-avx2.patch' "$VCPKG_OVERLAY_ROOT/libwebp/portfile.cmake"; then
  sed -i '/0009-cpufeatures-android.patch/a\        libwebp-mingw-gcc10-avx2.patch' \
    "$VCPKG_OVERLAY_ROOT/libwebp/portfile.cmake"
fi
chown -R "$BUILD_USER":"$(id -gn "$BUILD_USER")" "$VCPKG_OVERLAY_ROOT"
log "Précompilation unique des dépendances wxWidgets; les builds suivants réutiliseront ce cache."
run_as "$BUILD_USER" env \
  VCPKG_DEFAULT_BINARY_CACHE="$WX_BINARY_CACHE" \
  VCPKG_BINARY_SOURCES="clear;files,$WX_BINARY_CACHE,readwrite" \
  VCPKG_FEATURE_FLAGS=binarycaching \
  "$WX_VCPKG_ROOT/vcpkg" install wxwidgets nlohmann-json \
    --triplet "$WX_VCPKG_TRIPLET" --host-triplet x64-linux \
    --overlay-ports "$VCPKG_OVERLAY_ROOT" \
    --overlay-triplets "$SOURCE_ROOT/client-wx/cmake/vcpkg-triplets"

WX_CMAKE_WRAPPER="$WX_VCPKG_ROOT/installed/$WX_VCPKG_TRIPLET/share/wxwidgets/vcpkg-cmake-wrapper.cmake"
require_nonempty_file "$WX_CMAKE_WRAPPER" "Wrapper CMake wxWidgets absent après installation"
if grep -Fqx 'if(WIN32)' "$WX_CMAKE_WRAPPER"; then
  # Correction ciblée du wrapper vcpkg épinglé: sous MinGW, les cibles de
  # wxWidgetsConfig doivent être utilisées au lieu des anciens noms MSVC.
  sed -i '0,/^if(WIN32)$/s//if(WIN32 AND NOT MINGW)/' "$WX_CMAKE_WRAPPER"
fi
grep -Fqx 'if(WIN32 AND NOT MINGW)' "$WX_CMAKE_WRAPPER" \
  || die "Impossible d'adapter le wrapper wxWidgets à MinGW."

# Les buildtrees sont les objets temporaires de compilation (plusieurs Go).
# Les paquets installés et le cache binaire compressé suffisent aux builds futurs.
for temporary_root in "$WX_VCPKG_ROOT/buildtrees" "$WX_VCPKG_ROOT/packages"; do
  if [[ "$temporary_root" == "$WX_VCPKG_ROOT/"* && -d "$temporary_root" ]]; then
    find "$temporary_root" -mindepth 1 -delete
  fi
done

BASS_SHA256=3a03ec9a33d0f4f9d167660da51c8bb1432e8977496995455ab137277d69636e
BASS_DOWNLOAD="$CACHE_ROOT/downloads/bass24.zip"
if [[ ! -s "$BASS_DOWNLOAD" ]]; then
  log "Téléchargement unique du runtime BASS officiel."
  curl --fail --location --retry 4 --retry-all-errors \
    https://www.un4seen.com/files/bass24.zip -o "$BASS_DOWNLOAD"
fi
printf '%s  %s\n' "$BASS_SHA256" "$BASS_DOWNLOAD" | sha256sum --check
mkdir -p "$WX_BASS_ROOT"
unzip -jo "$BASS_DOWNLOAD" x64/bass.dll -d "$WX_BASS_ROOT" >/dev/null
(
  cd "$WX_BASS_ROOT"
  gendef bass.dll >/dev/null
  # bass.dll est compactée avec Petite : gendef prend alors à tort toutes
  # ses fonctions pour des données. Une import library DATA pousse MinGW à
  # générer des pseudo-relocations 32 bits qui débordent selon l'ASLR.
  sed -i 's/[[:space:]]DATA$//' bass.def
  x86_64-w64-mingw32-dlltool -d bass.def -l libbass.dll.a
)
chown -R "$BUILD_USER":"$(id -gn "$BUILD_USER")" "$WX_BASS_ROOT"

chmod 0755 "$SOURCE_ROOT/updatecmd" "$SOURCE_ROOT/tools/updatecmd/updatecmd.sh" \
  "$SOURCE_ROOT/tools/updatecmd/bootstrap.sh"
ln -sfn "$SOURCE_ROOT/updatecmd" /usr/local/sbin/updatecmd

LEGACY_DEPLOY_COMMAND=/usr/local/sbin/deploy-lemonde-prod
if [[ -f "$LEGACY_DEPLOY_COMMAND" && ! -f "${LEGACY_DEPLOY_COMMAND}.pre-updatecmd" ]]; then
  cp -a "$LEGACY_DEPLOY_COMMAND" "${LEGACY_DEPLOY_COMMAND}.pre-updatecmd"
fi
install -m 0750 -o root -g root \
  "$SOURCE_ROOT/backend/tools/systemd/lila-backend-deploy.sh" "$LEGACY_DEPLOY_COMMAND"

SERVICE_TEMP="$(mktemp)"
sed \
  -e "s|@BACKEND_RUNTIME_USER@|$BACKEND_RUNTIME_USER|g" \
  -e "s|@BACKEND_RUNTIME_GROUP@|$BACKEND_RUNTIME_GROUP|g" \
  -e "s|@INSTALL_ROOT@|$INSTALL_ROOT|g" \
  -e "s|@BACKEND_ENV_FILE@|$BACKEND_ENV_FILE|g" \
  "$SOURCE_ROOT/tools/updatecmd/systemd/lila-backend.service.in" >"$SERVICE_TEMP"
install -m 0644 "$SERVICE_TEMP" "$BACKEND_UNIT_FILE"
install -m 0644 "$SOURCE_ROOT/tools/updatecmd/systemd/lila-backend-deploy.service" \
  /etc/systemd/system/lila-backend-deploy.service
systemctl daemon-reload
systemctl enable "$BACKEND_SERVICE" >/dev/null

log "Bootstrap terminé. Exécutez 'sudo updatecmd doctor', puis 'sudo updatecmd all'."
if [[ ! -s "$WX_MANIFEST_PRIVATE_KEY" || ! -s "$WX_CODESIGN_PFX" || ! -s "$WX_CODESIGN_PASSWORD_FILE" ]]; then
  warn "Il reste à importer les secrets de signature existants dans /etc/lemonde-de-lila/secrets/."
fi

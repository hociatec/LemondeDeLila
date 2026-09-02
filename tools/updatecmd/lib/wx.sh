#!/usr/bin/env bash

wx_api() {
  local method="$1"
  local path="$2"
  shift 2
  curl --fail --silent --show-error \
    --retry 4 --retry-all-errors --retry-delay 2 \
    --connect-timeout 10 --max-time 300 \
    -X "$method" \
    -H "x-client-wx-updates-upload-token: $WX_UPLOAD_TOKEN" \
    "$@" "${WX_API_BASE%/}$path"
}

ensure_wx_mingw_wrapper_compatibility() {
  local wrapper="$WX_VCPKG_ROOT/installed/$WX_VCPKG_TRIPLET/share/wxwidgets/vcpkg-cmake-wrapper.cmake"
  require_nonempty_file "$wrapper" "Wrapper CMake wxWidgets absent"
  if grep -Fqx 'if(WIN32)' "$wrapper"; then
    # Le port vcpkg 2026.05 cherche les noms MSVC historiques avant de charger
    # wxWidgetsConfig, alors que MinGW fournit ses propres cibles CMake valides.
    sed -i '0,/^if(WIN32)$/s//if(WIN32 AND NOT MINGW)/' "$wrapper"
  fi
  grep -Fqx 'if(WIN32 AND NOT MINGW)' "$wrapper" \
    || die "Le wrapper wxWidgets installé n'est pas compatible avec MinGW."
}

ensure_wx_native_dependencies() {
  local miniz_config="$WX_VCPKG_ROOT/installed/$WX_VCPKG_TRIPLET/share/miniz/minizConfig.cmake"
  [[ -s "$miniz_config" ]] && return

  log "Installation de la dépendance native miniz du lanceur WX."
  run_as "$BUILD_USER" env \
    VCPKG_DEFAULT_BINARY_CACHE="$WX_BINARY_CACHE" \
    VCPKG_BINARY_SOURCES="clear;files,$WX_BINARY_CACHE,readwrite" \
    VCPKG_FEATURE_FLAGS=binarycaching \
    "$WX_VCPKG_ROOT/vcpkg" install miniz \
      --triplet "$WX_VCPKG_TRIPLET" --host-triplet x64-linux \
      --overlay-triplets "$SNAPSHOT_DIR/client-wx/cmake/vcpkg-triplets"
  require_nonempty_file "$miniz_config" "Configuration CMake miniz absente après installation"
}

resolve_wx_release() {
  local status_json="$1"
  local server_sequence server_version server_patch state_sequence state_patch next_patch epoch
  server_sequence="$(jq -r '.sequence // 0' "$status_json")"
  server_version="$(jq -r '.version // ""' "$status_json")"
  server_patch=0
  if [[ "$server_version" =~ ^${WX_VERSION_MAJOR}\.${WX_VERSION_MINOR}\.([0-9]+)(\.[0-9]+)?$ ]]; then
    server_patch="${BASH_REMATCH[1]}"
  fi
  state_sequence=0
  state_patch=0
  if [[ -s "$STATE_ROOT/client-wx.json" ]]; then
    state_sequence="$(jq -r '.sequence // 0' "$STATE_ROOT/client-wx.json" 2>/dev/null || printf '0')"
    state_patch="$(jq -r '.patch // 0' "$STATE_ROOT/client-wx.json" 2>/dev/null || printf '0')"
  fi
  [[ "$server_sequence" =~ ^[0-9]+$ ]] || server_sequence=0
  [[ "$state_sequence" =~ ^[0-9]+$ ]] || state_sequence=0
  [[ "$server_patch" =~ ^[0-9]+$ ]] || server_patch=0
  [[ "$state_patch" =~ ^[0-9]+$ ]] || state_patch=0

  next_patch=$((server_patch > state_patch ? server_patch + 1 : state_patch + 1))
  (( next_patch <= 999999 )) || die "Le compteur de version WX a atteint sa limite."
  WX_VERSION="${WX_VERSION_MAJOR}.${WX_VERSION_MINOR}.${next_patch}"
  epoch="$(date -u +%s)"
  WX_SEQUENCE=$((server_sequence > state_sequence ? server_sequence + 1 : state_sequence + 1))
  if (( epoch > WX_SEQUENCE )); then WX_SEQUENCE="$epoch"; fi
  WX_RELEASE_ID="local-${WX_VERSION}-${WX_SOURCE_ID:0:16}"
  WX_PUBLISHED_AT="$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"
  if [[ "$WX_MANDATORY" == "1" ]]; then
    WX_MANDATORY_AT="$WX_PUBLISHED_AT"
    WX_MINIMUM_VERSION="$WX_VERSION"
  else
    WX_MANDATORY_AT=""
    WX_MINIMUM_VERSION=""
  fi
}

prepare_wx_keys() {
  WX_CODESIGN_PASSWORD="$(tr -d '\r\n' <"$WX_CODESIGN_PASSWORD_FILE")"
  [[ -n "$WX_CODESIGN_PASSWORD" ]] || die "Mot de passe PFX vide."
  local public_der="$RUN_DIR/wx-update-public.der"
  local certificate_pem="$RUN_DIR/wx-codesign-cert.pem"
  local certificate_der="$RUN_DIR/wx-codesign-cert.der"

  openssl pkey -in "$WX_MANIFEST_PRIVATE_KEY" -pubout -outform DER -out "$public_der"
  WX_UPDATE_PUBLIC_KEY="$(base64 -w 0 "$public_der")"
  openssl pkcs12 -in "$WX_CODESIGN_PFX" \
    -passin "file:$WX_CODESIGN_PASSWORD_FILE" -clcerts -nokeys -out "$certificate_pem"
  openssl x509 -in "$certificate_pem" -outform DER -out "$certificate_der"
  WX_SIGNER_SHA256="$(sha256_file "$certificate_der")"
  WX_CODESIGN_CERT_PEM="$certificate_pem"
  if [[ -n "$WX_EXPECTED_SIGNER_SHA256" && "$WX_SIGNER_SHA256" != "${WX_EXPECTED_SIGNER_SHA256,,}" ]]; then
    die "Le PFX ne correspond pas au certificat déjà épinglé par les clients (attendu: $WX_EXPECTED_SIGNER_SHA256, obtenu: $WX_SIGNER_SHA256)."
  fi
}

configure_and_build_wx() {
  local source_dir="$CACHE_ROOT/client-wx-source"
  mkdir -p "$source_dir" "$WX_BUILD_DIR" "$WX_BINARY_CACHE"
  rsync -a --delete "$SNAPSHOT_DIR/client-wx/" "$source_dir/client-wx/"
  rsync -a --delete "$SNAPSHOT_DIR/backend/" "$source_dir/backend/"
  chown -R "$BUILD_USER":"$(id -gn "$BUILD_USER")" "$source_dir" "$WX_BUILD_DIR" "$WX_BINARY_CACHE"

  log "Configuration MinGW du client WX $WX_VERSION (cache persistant activé)."
  run_as "$BUILD_USER" env \
    VCPKG_DEFAULT_BINARY_CACHE="$WX_BINARY_CACHE" \
    VCPKG_BINARY_SOURCES="clear;files,$WX_BINARY_CACHE,readwrite" \
    VCPKG_FEATURE_FLAGS=binarycaching \
    cmake -S "$source_dir/client-wx" -B "$WX_BUILD_DIR" -G Ninja \
      -DCMAKE_BUILD_TYPE=Release \
      -DCMAKE_TOOLCHAIN_FILE="$WX_VCPKG_ROOT/scripts/buildsystems/vcpkg.cmake" \
      -DVCPKG_CHAINLOAD_TOOLCHAIN_FILE="$source_dir/client-wx/cmake/toolchains/mingw-w64-x86_64.cmake" \
      -DVCPKG_OVERLAY_TRIPLETS="$source_dir/client-wx/cmake/vcpkg-triplets" \
      -DVCPKG_TARGET_TRIPLET="$WX_VCPKG_TRIPLET" \
      -DVCPKG_HOST_TRIPLET=x64-linux \
      -DVCPKG_APPLOCAL_DEPS=OFF \
      -DwxWidgets_DIR="$WX_VCPKG_ROOT/installed/$WX_VCPKG_TRIPLET/share/wxwidgets" \
      -DLILA_PROJECT_VERSION="${WX_VERSION}.0" \
      -DLILA_UPDATE_PUBLIC_KEY_DER_BASE64="$WX_UPDATE_PUBLIC_KEY" \
      -DLILA_UPDATE_AUTHENTICODE_SIGNER_SHA256="$WX_SIGNER_SHA256" \
      -DLILA_BASS_RUNTIME_DLL="$WX_BASS_ROOT/bass.dll" \
      -DLILA_BASS_IMPORT_LIBRARY="$WX_BASS_ROOT/libbass.dll.a" \
      -DBUILD_TESTING=OFF

  log "Cross-compilation Windows x64."
  run_as "$BUILD_USER" cmake --build "$WX_BUILD_DIR" \
    --target lemonde_de_lila_wx lila_launcher --parallel "$(nproc)"
  require_nonempty_file "$WX_BUILD_DIR/lemonde_de_lila_wx.exe" "Exécutable WX absent"
  require_nonempty_file "$WX_BUILD_DIR/lila_launcher.exe" "Lanceur WX absent"
  require_nonempty_file "$WX_BUILD_DIR/lemonde_de_lila_wx.map" "Carte de symboles WX absente"
  if x86_64-w64-mingw32-nm -C "$WX_BUILD_DIR/lemonde_de_lila_wx.exe" \
      | grep -Eq '__fu[0-9]+_BASS_'; then
    die "Le client contient une pseudo-relocation BASS 32 bits dangereuse."
  fi
  log "Appels BASS vérifiés via l'IAT Windows 64 bits."
  local symbols_dir="$STATE_ROOT/client-wx-symbols"
  mkdir -p "$symbols_dir"
  install -m 0640 "$WX_BUILD_DIR/lemonde_de_lila_wx.map" \
    "$symbols_dir/${WX_VERSION}.map"
  file "$WX_BUILD_DIR/lemonde_de_lila_wx.exe" | grep -q 'PE32+' \
    || die "Le client produit n'est pas un exécutable Windows x64."
}

sign_windows_file() {
  local file_path="$1"
  local signed_path="${file_path}.signed"
  local name="$2"
  local -a timestamp_args=()
  if [[ -n "$WX_TIMESTAMP_URL" ]]; then
    timestamp_args=(-ts "$WX_TIMESTAMP_URL")
  fi
  local attempt
  for attempt in 1 2 3; do
    rm -f "$signed_path"
    if osslsigncode sign \
      -pkcs12 "$WX_CODESIGN_PFX" \
      -pass "$WX_CODESIGN_PASSWORD" \
      -n "$name" \
      -i "https://lilas.hociatec.fr" \
      -h sha256 \
      "${timestamp_args[@]}" \
      -in "$file_path" -out "$signed_path"; then
      break
    fi
    (( attempt < 3 )) || die "Signature Authenticode impossible après trois tentatives: $file_path"
    sleep 2
  done
  mv -f "$signed_path" "$file_path"
  osslsigncode verify -CAfile "$WX_CODESIGN_CERT_PEM" -in "$file_path" >/dev/null \
    || die "Signature Authenticode invalide: $file_path"
}

copy_mingw_runtime() {
  local payload="$1"
  local runtime_name runtime_path
  for runtime_name in libstdc++-6.dll libgcc_s_seh-1.dll libwinpthread-1.dll; do
    runtime_path="$(x86_64-w64-mingw32-g++-posix -print-file-name="$runtime_name")"
    [[ -f "$runtime_path" ]] || die "Runtime MinGW introuvable: $runtime_name"
    install -m 0644 "$runtime_path" "$payload/$runtime_name"
  done
}

copy_vcpkg_runtime_closure() {
  local payload="$1"
  local dependencies="$RUN_DIR/wx-runtime-copy-dependencies.txt"
  local dependency candidate copied
  while true; do
    copied=0
    find "$payload" -maxdepth 1 -type f \( -iname '*.exe' -o -iname '*.dll' \) -print0 \
      | xargs -0 -r x86_64-w64-mingw32-objdump -p 2>/dev/null \
      | sed -n 's/^[[:space:]]*DLL Name:[[:space:]]*//p' \
      | LC_ALL=C sort -fu >"$dependencies"
    while IFS= read -r dependency; do
      [[ -n "$dependency" ]] || continue
      if find "$payload" -maxdepth 1 -type f -iname "$dependency" -print -quit | grep -q .; then
        continue
      fi
      candidate="$(find \
        "$WX_VCPKG_ROOT/installed/$WX_VCPKG_TRIPLET/bin" \
        "$WX_VCPKG_ROOT/installed/$WX_VCPKG_TRIPLET/lib" \
        -maxdepth 1 -type f -iname "$dependency" -print -quit)"
      if [[ -n "$candidate" ]]; then
        install -m 0644 "$candidate" "$payload/$(basename "$candidate")"
        copied=1
      fi
    done <"$dependencies"
    (( copied == 0 )) && break
  done
}

is_windows_system_dependency() {
  local dependency="${1,,}"
  case "$dependency" in
    api-ms-win-*.dll|ext-ms-win-*.dll|advapi32.dll|avrt.dll|bcrypt.dll|cfgmgr32.dll|comctl32.dll|comdlg32.dll|crypt32.dll|cryptui.dll|dbghelp.dll|dwmapi.dll|dwrite.dll|gdi32.dll|gdiplus.dll|glu32.dll|imm32.dll|iphlpapi.dll|kernel32.dll|kernelbase.dll|mpr.dll|msacm32.dll|msimg32.dll|msvcrt.dll|netapi32.dll|normaliz.dll|ntdll.dll|ole32.dll|oleacc.dll|oleaut32.dll|opengl32.dll|powrprof.dll|psapi.dll|rpcrt4.dll|secur32.dll|setupapi.dll|shell32.dll|shlwapi.dll|user32.dll|userenv.dll|uxtheme.dll|version.dll|winhttp.dll|wininet.dll|winmm.dll|winspool.drv|wintrust.dll|ws2_32.dll|wtsapi32.dll)
      return 0
      ;;
    *) return 1 ;;
  esac
}

verify_launcher_is_self_contained() {
  local launcher="$1"
  local dependency
  local -a external=()
  while IFS= read -r dependency; do
    [[ -n "$dependency" ]] || continue
    if ! is_windows_system_dependency "$dependency"; then
      external+=("$dependency")
    fi
  done < <(
    x86_64-w64-mingw32-objdump -p "$launcher" 2>/dev/null \
      | sed -n 's/^[[:space:]]*DLL Name:[[:space:]]*//p' \
      | tr '[:upper:]' '[:lower:]' | LC_ALL=C sort -u
  )
  if (( ${#external[@]} > 0 )); then
    die "Le lanceur racine dépend encore de DLL non système: ${external[*]}"
  fi
  log "Lanceur Windows autonome vérifié."
}

verify_common_controls_manifest() {
  local executable="$1"
  grep -aFq 'Microsoft.Windows.Common-Controls' "$executable" \
    || die "Manifeste Windows Common Controls v6 absent: $executable"
  log "Manifeste Windows Common Controls v6 vérifié: $(basename "$executable")."
}

verify_windows_runtime_closure() {
  local payload="$1"
  local dependencies="$RUN_DIR/wx-runtime-dependencies.txt"
  local packaged="$RUN_DIR/wx-runtime-packaged.txt"
  local missing="$RUN_DIR/wx-runtime-missing.txt"
  find "$payload" -maxdepth 1 -type f \( -iname '*.exe' -o -iname '*.dll' \) -print0 \
    | xargs -0 -r x86_64-w64-mingw32-objdump -p 2>/dev/null \
    | sed -n 's/^[[:space:]]*DLL Name:[[:space:]]*//p' \
    | tr '[:upper:]' '[:lower:]' | LC_ALL=C sort -u >"$dependencies"
  find "$payload" -maxdepth 1 -type f -iname '*.dll' -printf '%f\n' \
    | tr '[:upper:]' '[:lower:]' | LC_ALL=C sort -u >"$packaged"

  : >"$missing"
  local dependency
  while IFS= read -r dependency; do
    [[ -n "$dependency" ]] || continue
    if grep -Fqx "$dependency" "$packaged"; then
      continue
    fi
    is_windows_system_dependency "$dependency" \
      || printf '%s\n' "$dependency" >>"$missing"
  done <"$dependencies"
  if [[ -s "$missing" ]]; then
    warn "DLL Windows non empaquetées: $(paste -sd, "$missing" | sed 's/,/, /g')"
    return 1
  fi
  log "Fermeture des dépendances Windows vérifiée ($(wc -l <"$dependencies") imports uniques)."
}

package_wx_release() {
  local payload="$RUN_DIR/wx-package/payload"
  local output="$RUN_DIR/wx-package/output"
  mkdir -p "$payload" "$output"

  install -m 0755 "$WX_BUILD_DIR/lemonde_de_lila_wx.exe" "$payload/"
  install -m 0755 "$WX_BUILD_DIR/lila_launcher.exe" "$payload/"
  verify_launcher_is_self_contained "$payload/lila_launcher.exe"
  verify_common_controls_manifest "$payload/lemonde_de_lila_wx.exe"
  verify_common_controls_manifest "$payload/lila_launcher.exe"
  find "$WX_BUILD_DIR" -maxdepth 1 -type f -iname '*.dll' -exec install -m 0644 '{}' "$payload/" \;
  install -m 0644 "$WX_BASS_ROOT/bass.dll" "$payload/bass.dll"
  copy_mingw_runtime "$payload"
  copy_vcpkg_runtime_closure "$payload"
  if [[ -d "$WX_BUILD_DIR/resources" ]]; then
    rsync -a "$WX_BUILD_DIR/resources/" "$payload/resources/"
  fi
  if [[ -d "$WX_BUILD_DIR/libs" ]]; then
    rsync -a "$WX_BUILD_DIR/libs/" "$payload/libs/"
  fi
  verify_windows_runtime_closure "$payload" \
    || die "Le paquet WX serait inutilisable sur une machine Windows propre."

  log "Signature Authenticode du client et du lanceur."
  sign_windows_file "$payload/lemonde_de_lila_wx.exe" "Le Monde de Lila"
  sign_windows_file "$payload/lila_launcher.exe" "Le Monde de Lila - Launcher"

  WX_UPDATE_ZIP="$output/client-wx-${WX_VERSION}-windows-x64.zip"
  (
    cd "$payload" || exit 1
    zip -q -9 -r "$WX_UPDATE_ZIP" .
  )
  WX_ARTIFACT_SIZE="$(stat -c '%s' "$WX_UPDATE_ZIP")"
  WX_ARTIFACT_SHA256="$(sha256_file "$WX_UPDATE_ZIP")"

  WX_INSTALLER="$output/LeMondeDeLilaWX-${WX_VERSION}-Setup.exe"
  makensis \
    -DAPP_VERSION="$WX_VERSION" \
    -DPAYLOAD_DIR="$payload" \
    -DOUTPUT_FILE="$WX_INSTALLER" \
    "$SNAPSHOT_DIR/client-wx/packaging/LeMondeDeLilaWX.nsi" >/dev/null
  require_nonempty_file "$WX_INSTALLER" "Installateur NSIS absent"
  log "Signature Authenticode de l'installateur."
  sign_windows_file "$WX_INSTALLER" "Le Monde de Lila - Setup"
  WX_INSTALLER_SIZE="$(stat -c '%s' "$WX_INSTALLER")"
  WX_INSTALLER_SHA256="$(sha256_file "$WX_INSTALLER")"
}

sign_wx_manifest() {
  local canonical="$RUN_DIR/wx-manifest-canonical.txt"
  local signature_file="$RUN_DIR/wx-manifest.sig"
  local canonical_mandatory="${WX_MANDATORY_AT:--}"
  local canonical_minimum="${WX_MINIMUM_VERSION:--}"
  printf '%s' "lila-client-wx-manifest-v2
product=client-wx
platform=windows
architecture=x64
channel=stable
releaseId=$WX_RELEASE_ID
version=$WX_VERSION
sequence=$WX_SEQUENCE
publishedAt=$WX_PUBLISHED_AT
mandatoryAt=$canonical_mandatory
minimumVersion=$canonical_minimum
artifactSize=$WX_ARTIFACT_SIZE
artifactSha256=$WX_ARTIFACT_SHA256" >"$canonical"
  openssl dgst -sha256 -sign "$WX_MANIFEST_PRIVATE_KEY" -out "$signature_file" "$canonical"
  WX_MANIFEST_SIGNATURE="$(base64 -w 0 "$signature_file")"
  openssl dgst -sha256 -verify <(openssl pkey -in "$WX_MANIFEST_PRIVATE_KEY" -pubout) \
    -signature "$signature_file" "$canonical" >/dev/null \
    || die "Auto-vérification de la signature du manifeste impossible."
}

upload_file_chunks() {
  local upload_id="$1"
  local kind="$2"
  local file_path="$3"
  local chunks_dir="$RUN_DIR/chunks-$kind"
  mkdir -p "$chunks_dir"
  split -b 10M -d -a 6 "$file_path" "$chunks_dir/part."
  local index=0 part
  for part in "$chunks_dir"/part.*; do
    log "Envoi $kind chunk $index ($(stat -c '%s' "$part") octets)."
    wx_api POST "/api/ci/client-wx-updates/upload/chunk" \
      -F "uploadId=$upload_id" -F "kind=$kind" -F "index=$index" -F "file=@$part" >/dev/null
    index=$((index + 1))
  done
}

publish_wx_release() {
  local init_json="$RUN_DIR/wx-upload-init.json"
  jq -n \
    --arg releaseId "$WX_RELEASE_ID" \
    --arg version "$WX_VERSION" \
    --argjson sequence "$WX_SEQUENCE" \
    --arg publishedAt "$WX_PUBLISHED_AT" \
    --arg message "$WX_MESSAGE" \
    --arg minimumVersion "$WX_MINIMUM_VERSION" \
    --arg mandatoryAt "$WX_MANDATORY_AT" \
    --arg sha256 "$WX_ARTIFACT_SHA256" \
    --arg signature "$WX_MANIFEST_SIGNATURE" \
    --argjson totalBytes "$WX_ARTIFACT_SIZE" \
    --arg installerSha256 "$WX_INSTALLER_SHA256" \
    --argjson installerTotalBytes "$WX_INSTALLER_SIZE" \
    '{releaseId:$releaseId,version:$version,sequence:$sequence,publishedAt:$publishedAt,message:$message,minimumVersion:$minimumVersion,mandatoryAt:$mandatoryAt,sha256:$sha256,signature:$signature,totalBytes:$totalBytes,installerSha256:$installerSha256,installerTotalBytes:$installerTotalBytes}' \
    >"$init_json"

  local response="$RUN_DIR/wx-upload-response.json"
  wx_api POST "/api/ci/client-wx-updates/upload/init" \
    -H 'Content-Type: application/json' --data-binary "@$init_json" >"$response"
  local upload_id
  upload_id="$(jq -r '.uploadId // empty' "$response")"
  [[ "$upload_id" =~ ^[A-Za-z0-9-]+$ ]] || die "L'API n'a pas retourné un uploadId valide."
  upload_file_chunks "$upload_id" artifact "$WX_UPDATE_ZIP"
  upload_file_chunks "$upload_id" installer "$WX_INSTALLER"
  printf '{"uploadId":"%s"}\n' "$upload_id" >"$RUN_DIR/wx-complete.json"
  wx_api POST "/api/ci/client-wx-updates/upload/complete" \
    -H 'Content-Type: application/json' --data-binary "@$RUN_DIR/wx-complete.json" >"$response"
  [[ "$(jq -r '.manifest.releaseId // empty' "$response")" == "$WX_RELEASE_ID" ]] \
    || die "La publication WX n'a pas confirmé la release attendue."

  local state_tmp="$STATE_ROOT/client-wx.json.tmp.$$"
  jq -n --arg sourceId "$WX_SOURCE_ID" --arg releaseId "$WX_RELEASE_ID" \
    --arg version "$WX_VERSION" --argjson patch "${WX_VERSION##*.}" \
    --argjson sequence "$WX_SEQUENCE" --arg publishedAt "$WX_PUBLISHED_AT" \
    '{sourceId:$sourceId,releaseId:$releaseId,version:$version,patch:$patch,sequence:$sequence,publishedAt:$publishedAt}' \
    >"$state_tmp"
  mv -f "$state_tmp" "$STATE_ROOT/client-wx.json"
  log "Client WX $WX_VERSION publié avec succès ($WX_RELEASE_ID)."
}

build_and_publish_wx() {
  local command
  for command in base64 cmake curl file jq makensis ninja openssl osslsigncode split \
    x86_64-w64-mingw32-g++-posix x86_64-w64-mingw32-nm \
    x86_64-w64-mingw32-objdump zip; do
    require_command "$command"
  done
  require_nonempty_file "$WX_UPLOAD_TOKEN_FILE" "Token d'upload WX absent"
  require_nonempty_file "$WX_MANIFEST_PRIVATE_KEY" "Clé privée du manifeste WX absente"
  require_nonempty_file "$WX_CODESIGN_PFX" "Certificat PFX de signature absent"
  require_nonempty_file "$WX_CODESIGN_PASSWORD_FILE" "Mot de passe PFX absent"
  require_nonempty_file "$WX_VCPKG_ROOT/vcpkg" "vcpkg absent"
  require_nonempty_file "$WX_BASS_ROOT/bass.dll" "Runtime BASS absent"
  require_nonempty_file "$WX_BASS_ROOT/libbass.dll.a" "Bibliothèque d'import BASS MinGW absente"
  ensure_wx_mingw_wrapper_compatibility
  ensure_wx_native_dependencies

  WX_UPLOAD_TOKEN="$(tr -d '\r\n' <"$WX_UPLOAD_TOKEN_FILE")"
  [[ -n "$WX_UPLOAD_TOKEN" ]] || die "Token WX vide."
  local status_json="$RUN_DIR/wx-status.json"
  wx_api GET "/api/ci/client-wx-updates/status" >"$status_json"
  local last_source="" last_release="" server_release=""
  if [[ -s "$STATE_ROOT/client-wx.json" ]]; then
    last_source="$(jq -r '.sourceId // empty' "$STATE_ROOT/client-wx.json" 2>/dev/null || true)"
    last_release="$(jq -r '.releaseId // empty' "$STATE_ROOT/client-wx.json" 2>/dev/null || true)"
  fi
  server_release="$(jq -r '.releaseId // empty' "$status_json" 2>/dev/null || true)"
  if [[ "$last_source" == "$WX_SOURCE_ID" && "$last_release" == "$server_release" && "$FORCE" != "1" ]]; then
    log "Cette source a déjà été publiée pour le client WX; aucune reconstruction."
    return
  fi

  resolve_wx_release "$status_json"
  prepare_wx_keys
  configure_and_build_wx
  package_wx_release
  sign_wx_manifest
  publish_wx_release
}

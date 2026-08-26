#!/usr/bin/env bash

backend_release_dir() {
  printf '%s/releases/%s' "$INSTALL_ROOT" "$BACKEND_SOURCE_ID"
}

prepare_backend_release() {
  local release_dir
  release_dir="$(backend_release_dir)"
  local backend_dir="$release_dir/backend"

  if [[ -s "$backend_dir/dist/main.js" && -d "$backend_dir/node_modules" \
    && -s "$release_dir/.validated" \
    && "$(<"$release_dir/.validated")" == "$BACKEND_SOURCE_ID" \
    && "$FORCE" != "1" ]]; then
    log "Backend déjà construit et validé pour $BACKEND_SOURCE_ID; réutilisation de la release."
    BACKEND_RELEASE_DIR="$release_dir"
    return
  fi

  log "Préparation du backend $BACKEND_SOURCE_ID pendant que la version courante reste active."
  mkdir -p "$release_dir"
  rsync -a --delete \
    --exclude '/node_modules/' \
    --exclude '/dist/' \
    --exclude '/.env' \
    "$SNAPSHOT_DIR/backend/" "$backend_dir/"
  mkdir -p "$backend_dir/data"
  ln -sfn "$BACKEND_SHARED_DATA_ROOT/sounds" "$backend_dir/data/sounds"
  ln -sfn "$BACKEND_ENV_FILE" "$backend_dir/.env"
  printf 'LEMONDEDELILA_BUILD_ID=%s\nSOURCE_VERSION=%s\n' "$BACKEND_SOURCE_ID" "$BACKEND_SOURCE_ID" \
    >"$release_dir/.release.env"
  chown -R "$BUILD_USER":"$(id -gn "$BUILD_USER")" "$release_dir"

  local dependencies_id dependencies_dir
  dependencies_id="$(printf '%s\n%s\n' "$(sha256_file "$backend_dir/package.json")" "$(sha256_file "$backend_dir/package-lock.json")" | sha256sum | awk '{print $1}')"
  dependencies_dir="$CACHE_ROOT/backend-dependencies/$dependencies_id"
  if [[ ! -x "$dependencies_dir/node_modules/.bin/nest" ]]; then
    log "Installation npm partagée depuis le cache local ($dependencies_id)."
    mkdir -p "$dependencies_dir"
    install -m 0644 "$backend_dir/package.json" "$dependencies_dir/package.json"
    install -m 0644 "$backend_dir/package-lock.json" "$dependencies_dir/package-lock.json"
    chown -R "$BUILD_USER":"$(id -gn "$BUILD_USER")" "$dependencies_dir"
    # Les paramètres $1 sont volontairement développés par le bash enfant.
    # shellcheck disable=SC2016
    run_as "$BUILD_USER" env \
      npm_config_cache="$CACHE_ROOT/npm" \
      npm_config_audit=false \
      npm_config_fund=false \
      npm_config_strict_allow_scripts=true \
      bash -c 'set -euo pipefail; cd "$1"; npm ci --prefer-offline --no-audit --no-fund' \
      _ "$dependencies_dir"
  else
    log "Dépendances npm déjà disponibles; aucune réinstallation."
  fi
  ln -sfn "$dependencies_dir/node_modules" "$backend_dir/node_modules"

  log "Vérification des dépendances natives backend."
  run_as "$BUILD_USER" node "$backend_dir/commands/verify-runtime-dependencies.cjs"

  log "Compilation backend."
  # shellcheck disable=SC2016
  run_as "$BUILD_USER" bash -c 'set -euo pipefail; cd "$1"; npm run build' _ "$backend_dir"

  if [[ -n "$BACKEND_TEST_COMMAND" ]]; then
    log "Tests backend pré-déploiement: $BACKEND_TEST_COMMAND"
    # shellcheck disable=SC2016
    run_as "$BUILD_USER" bash -c 'set -euo pipefail; cd "$1"; shift; exec bash -c "$*"' \
      _ "$backend_dir" "$BACKEND_TEST_COMMAND"
  fi
  [[ -s "$backend_dir/dist/main.js" ]] || die "Le build backend n'a pas produit dist/main.js."
  printf '%s\n' "$BACKEND_SOURCE_ID" >"$release_dir/.validated"
  BACKEND_RELEASE_DIR="$release_dir"
}

backend_release_is_healthy() {
  local expected="$1"
  local build_response="$RUN_DIR/backend-build-info.json"
  local readiness_response="$RUN_DIR/backend-readiness.json"
  curl --fail --silent --max-time 3 "$BACKEND_HEALTH_URL" -o "$build_response" \
    && jq -e --arg expected "$expected" '.build.sha == $expected' "$build_response" >/dev/null \
    && curl --fail --silent --max-time 3 "$BACKEND_READINESS_URL" -o "$readiness_response" \
    && jq -e \
      '.status == "ok" and .details.database.status == "up" and .details.redis.status == "up"' \
      "$readiness_response" >/dev/null
}

wait_for_backend_health() {
  local expected="$1"
  local _attempt
  for _attempt in {1..30}; do
    if backend_release_is_healthy "$expected"; then
      return 0
    fi
    sleep 2
  done
  return 1
}

install_backend_service_unit() {
  require_file "$BACKEND_UNIT_FILE" "Unité backend préparée absente"
  local active_unit="/etc/systemd/system/$BACKEND_SERVICE"
  BACKEND_UNIT_CHANGED=0
  if [[ -f "$active_unit" ]] && cmp -s "$BACKEND_UNIT_FILE" "$active_unit"; then
    return
  fi
  if [[ -f "$active_unit" ]]; then
    cp -a "$active_unit" "$RUN_DIR/backend-service.previous"
    if [[ ! -f "${active_unit}.pre-updatecmd" ]]; then
      cp -a "$active_unit" "${active_unit}.pre-updatecmd"
    fi
  fi
  install -m 0644 "$BACKEND_UNIT_FILE" "$active_unit"
  systemctl daemon-reload
  BACKEND_UNIT_CHANGED=1
}

restore_initial_backend_service() {
  local active_unit="/etc/systemd/system/$BACKEND_SERVICE"
  if [[ "$BACKEND_UNIT_CHANGED" == "1" && -f "$RUN_DIR/backend-service.previous" ]]; then
    install -m 0644 "$RUN_DIR/backend-service.previous" "$active_unit"
    systemctl daemon-reload
  fi
}

activate_backend_release() {
  local release_dir="$BACKEND_RELEASE_DIR"
  local current_link="$INSTALL_ROOT/current"
  local previous_target=""
  if [[ -L "$current_link" ]]; then
    previous_target="$(readlink -f "$current_link" || true)"
  fi

  log "Exécution des migrations avant la bascule applicative."
  # shellcheck disable=SC2016
  run_as "$BACKEND_RUNTIME_USER" bash -c \
    'set -euo pipefail; cd "$1/backend"; npm run migration:run' _ "$release_dir"

  install_backend_service_unit
  log "Bascule atomique vers $BACKEND_SOURCE_ID et redémarrage de $BACKEND_SERVICE."
  atomic_symlink "$release_dir" "$current_link"
  if ! systemctl restart "$BACKEND_SERVICE" || ! wait_for_backend_health "$BACKEND_SOURCE_ID"; then
    warn "La nouvelle release n'est pas saine; restauration de la release précédente."
    if [[ -n "$previous_target" && -d "$previous_target" ]]; then
      atomic_symlink "$previous_target" "$current_link"
      systemctl restart "$BACKEND_SERVICE" || true
      wait_for_backend_health "$(basename "$previous_target")" || true
    else
      rm -f "$current_link"
      restore_initial_backend_service
      systemctl restart "$BACKEND_SERVICE" || true
    fi
    systemctl --no-pager --full status "$BACKEND_SERVICE" || true
    journalctl -u "$BACKEND_SERVICE" --no-pager -n 120 || true
    die "Déploiement backend annulé et rollback exécuté."
  fi

  if [[ -n "$previous_target" && -d "$previous_target" ]]; then
    atomic_symlink "$previous_target" "$INSTALL_ROOT/previous-successful"
  fi
  log "Backend $BACKEND_SOURCE_ID actif et vérifié."
  prune_backend_releases
}

prune_backend_releases() {
  [[ "$BACKEND_KEEP_RELEASES" =~ ^[0-9]+$ ]] || die "BACKEND_KEEP_RELEASES invalide."
  (( BACKEND_KEEP_RELEASES >= 2 )) || die "BACKEND_KEEP_RELEASES doit être au moins 2."
  local current previous
  current="$(readlink -f "$INSTALL_ROOT/current" 2>/dev/null || true)"
  previous="$(readlink -f "$INSTALL_ROOT/previous-successful" 2>/dev/null || true)"
  mapfile -t releases < <(find "$INSTALL_ROOT/releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -nr | awk '{print $2}')
  local kept=0 release
  for release in "${releases[@]}"; do
    if [[ "$release" == "$current" || "$release" == "$previous" || "$kept" -lt "$BACKEND_KEEP_RELEASES" ]]; then
      kept=$((kept + 1))
      continue
    fi
    [[ "$release" == "$INSTALL_ROOT/releases/"* ]] || die "Refus de supprimer une release hors de INSTALL_ROOT: $release"
    log "Suppression de l'ancienne release: $release"
    rm -rf --one-file-system "$release"
  done
}

deploy_backend() {
  require_file "$BACKEND_ENV_FILE" "Fichier d'environnement backend absent"
  require_command npm
  require_command node
  require_command jq
  require_command curl
  require_command systemctl
  prepare_backend_release
  local current_release
  current_release="$(readlink -f "$INSTALL_ROOT/current" 2>/dev/null || true)"
  if [[ "$FORCE" != "1" && "$current_release" == "$BACKEND_RELEASE_DIR" ]] \
    && backend_release_is_healthy "$BACKEND_SOURCE_ID"; then
    log "Backend $BACKEND_SOURCE_ID déjà actif et sain; aucune bascule."
    return
  fi
  activate_backend_release
}

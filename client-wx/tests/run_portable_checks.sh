#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_DIR="${TMPDIR:-/tmp}/lila-portable-tests"
mkdir -p "$BUILD_DIR"
COMMON_FLAGS=(-std=c++20 -Wall -Wextra -Wpedantic -Werror -I"$ROOT/src")

# Compile each translation unit concurrently. The former implementation passed
# every source to a single compiler driver, which compiled them serially and
# made this portable suite need several minutes on CI runners.
cxx_build() {
  local args=("$@") output="" has_compile_only=0
  local -a flags=() sources=() objects=() pids=()
  local skip_output=0 index=0

  for ((index = 0; index < ${#args[@]}; ++index)); do
    if ((skip_output)); then
      output="${args[index]}"
      skip_output=0
    elif [[ "${args[index]}" == "-o" ]]; then
      skip_output=1
    elif [[ "${args[index]}" == "-c" ]]; then
      has_compile_only=1
      flags+=("${args[index]}")
    elif [[ "${args[index]}" == *.cpp ]]; then
      sources+=("${args[index]}")
    else
      flags+=("${args[index]}")
    fi
  done

  if ((has_compile_only)) || ((${#sources[@]} <= 1)); then
    c++ "${args[@]}"
    return
  fi

  local object_dir="$BUILD_DIR/objects/$(basename "$output")"
  mkdir -p "$object_dir"
  local jobs
  jobs="$(nproc)"
  ((jobs > 4)) && jobs=4

  index=0
  for source in "${sources[@]}"; do
    local object="$object_dir/$index.o"
    objects+=("$object")
    c++ "${flags[@]}" -c "$source" -o "$object" &
    pids+=("$!")
    ((++index))
    if ((${#pids[@]} >= jobs)); then
      wait "${pids[0]}"
      pids=("${pids[@]:1}")
    fi
  done
  for pid in "${pids[@]}"; do
    wait "$pid"
  done
  c++ "${flags[@]}" "${objects[@]}" -o "$output"
}

cxx_build "${COMMON_FLAGS[@]}" "$ROOT/tests/GameSoundPolicyTests.cpp" \
  "$ROOT/src/modules/audio/domain/SoundCatalog.cpp" \
  "$ROOT/src/modules/audio/application/SoundVolumeResolver.cpp" \
  -o "$BUILD_DIR/game-sound-policy-tests"
"$BUILD_DIR/game-sound-policy-tests"
JSON_INCLUDE="$BUILD_DIR/dependencies/nlohmann-json-3.12.0"
mkdir -p "$JSON_INCLUDE/nlohmann" "$BUILD_DIR/generated"

fetch_json_header() {
  local name="$1"
  local expected_hash="$2"
  local target="$JSON_INCLUDE/nlohmann/$name"
  if [[ ! -f "$target" ]] || [[ "$(sha256sum "$target" | cut -d' ' -f1)" != "$expected_hash" ]]; then
    curl --fail --location --silent --show-error \
      "https://raw.githubusercontent.com/nlohmann/json/v3.12.0/single_include/nlohmann/$name" \
      --output "$target"
  fi
  local actual_hash
  actual_hash="$(sha256sum "$target" | cut -d' ' -f1)"
  if [[ "$actual_hash" != "$expected_hash" ]]; then
    echo "Empreinte nlohmann-json invalide pour $name." >&2
    exit 1
  fi
}

fetch_json_header json.hpp aaf127c04cb31c406e5b04a63f1ae89369fccde6d8fa7cdda1ed4f32dfc5de63
fetch_json_header json_fwd.hpp fb6aa70cbece087f37ab4685c182b287c53be54f785f981b9db9d30d2d028b37

cxx_build "${COMMON_FLAGS[@]}" -I"$JSON_INCLUDE" \
  "$ROOT/tests/AudioRegressionTests.cpp" \
  "$ROOT/src/modules/audio/application/AudioService.cpp" \
  "$ROOT/src/modules/audio/application/SoundVolumeResolver.cpp" \
  "$ROOT/src/modules/audio/domain/SoundCatalog.cpp" \
  "$ROOT/src/modules/audio/infrastructure/NotificationAudioDecoder.cpp" \
  "$ROOT/src/modules/gameplay/state/infrastructure/GameSystemDecoder.cpp" \
  "$ROOT/src/modules/gameplay/state/infrastructure/GameValueDecoder.cpp" \
  "$ROOT/src/modules/gameplay/state/infrastructure/GamePayloadJsonReader.cpp" \
  "$ROOT/src/modules/chat/application/ChatMessageStore.cpp" \
  -o "$BUILD_DIR/audio-regression-tests"
"$BUILD_DIR/audio-regression-tests"

sed \
  -e 's/@PROJECT_VERSION@/portable-test/g' \
  -e 's/@PROJECT_VERSION_MAJOR@/0/g' \
  -e 's/@PROJECT_VERSION_MINOR@/0/g' \
  -e 's/@PROJECT_VERSION_PATCH@/0/g' \
  "$ROOT/src/shared/config/generated/AppBuildInfo.h.in" \
  > "$BUILD_DIR/generated/AppBuildInfo.h"

cxx_build "${COMMON_FLAGS[@]}" -I"$JSON_INCLUDE" -I"$BUILD_DIR/generated" \
  "$ROOT/tests/MessagingProtocolTests.cpp" \
  "$ROOT/src/modules/messaging/infrastructure/MessagingPayloadCodec.cpp" \
  "$ROOT/src/shared/network/application/realtime/RealtimeProtocol.cpp" \
  "$ROOT/src/shared/network/application/realtime/ReconnectPolicy.cpp" \
  "$ROOT/src/shared/config/domain/AppConfig.cpp" \
  -o "$BUILD_DIR/messaging-protocol-tests"
"$BUILD_DIR/messaging-protocol-tests"

cxx_build "${COMMON_FLAGS[@]}" \
  "$ROOT/tests/UrlUtilsTests.cpp" \
  -o "$BUILD_DIR/url-utils-tests"
"$BUILD_DIR/url-utils-tests"

cxx_build "${COMMON_FLAGS[@]}" -pthread \
  "$ROOT/tests/BackgroundExecutorTests.cpp" \
  "$ROOT/src/shared/concurrency/application/BackgroundExecutor.cpp" \
  "$ROOT/src/shared/concurrency/application/BackgroundTasks.cpp" \
  "$ROOT/src/shared/logging/infrastructure/Logger.cpp" \
  -o "$BUILD_DIR/background-executor-tests"
(
  cd "$BUILD_DIR"
  ./background-executor-tests
)

cxx_build "${COMMON_FLAGS[@]}" -pthread \
  "$ROOT/tests/ReconnectPolicyTests.cpp" \
  "$ROOT/src/shared/network/application/realtime/ReconnectPolicy.cpp" \
  -o "$BUILD_DIR/reconnect-policy-tests"
"$BUILD_DIR/reconnect-policy-tests"

cxx_build "${COMMON_FLAGS[@]}" \
  "$ROOT/tests/GamePlayLifecycleTests.cpp" \
  "$ROOT/src/modules/gameplay/shell/application/GamePlayLifecycle.cpp" \
  -o "$BUILD_DIR/gameplay-lifecycle-tests"
"$BUILD_DIR/gameplay-lifecycle-tests"

cxx_build "${COMMON_FLAGS[@]}" \
  "$ROOT/tests/GameEventIdentityWindowTests.cpp" \
  "$ROOT/src/modules/gameplay/events/application/GameEventIdentityWindow.cpp" \
  -o "$BUILD_DIR/game-event-identity-tests"
"$BUILD_DIR/game-event-identity-tests"

cxx_build "${COMMON_FLAGS[@]}" \
  "$ROOT/tests/SocialDataStoreTests.cpp" \
  "$ROOT/src/modules/social/presentation/SocialDataStore.cpp" \
  -o "$BUILD_DIR/social-data-store-tests"
"$BUILD_DIR/social-data-store-tests"

cxx_build "${COMMON_FLAGS[@]}" \
  "$ROOT/tests/MessagingSelectionMemoryTests.cpp" \
  "$ROOT/src/modules/messaging/presentation/MessagingSelectionMemory.cpp" \
  -o "$BUILD_DIR/messaging-selection-memory-tests"
"$BUILD_DIR/messaging-selection-memory-tests"

cxx_build "${COMMON_FLAGS[@]}" \
  "$ROOT/tests/NavigationStateTests.cpp" \
  "$ROOT/src/modules/main_menu/presentation/MainMenuContent.cpp" \
  "$ROOT/src/modules/admin/domain/AdminCommandCatalog.cpp" \
  "$ROOT/src/modules/admin/domain/AdminCommandCatalog.Moderation.cpp" \
  "$ROOT/src/modules/admin/domain/AdminCommandCatalog.Content.cpp" \
  "$ROOT/src/modules/admin/domain/AdminCommandCatalog.Operations.cpp" \
  "$ROOT/src/modules/admin/domain/AdminArea.cpp" \
  "$ROOT/src/shared/security/infrastructure/SecurityUtils.cpp" \
  -o "$BUILD_DIR/navigation-state-tests"
"$BUILD_DIR/navigation-state-tests"

cxx_build "${COMMON_FLAGS[@]}" -I"$JSON_INCLUDE" \
  "$ROOT/tests/AdminContractTests.cpp" \
  "$ROOT/src/modules/admin/domain/AdminCommandCatalog.cpp" \
  "$ROOT/src/modules/admin/domain/AdminCommandCatalog.Moderation.cpp" \
  "$ROOT/src/modules/admin/domain/AdminCommandCatalog.Content.cpp" \
  "$ROOT/src/modules/admin/domain/AdminCommandCatalog.Operations.cpp" \
  "$ROOT/src/modules/admin/domain/AdminFormMetadata.cpp" \
  "$ROOT/src/modules/admin/domain/AdminFormMetadata.BugReports.cpp" \
  "$ROOT/src/modules/admin/infrastructure/AdminPayloadValidator.cpp" \
  "$ROOT/src/modules/admin/presentation/AdminResultFormatter.cpp" \
  "$ROOT/src/shared/network/infrastructure/http/AuthenticatedHttpClient.cpp" \
  -o "$BUILD_DIR/admin-contract-tests"
"$BUILD_DIR/admin-contract-tests"

node "$ROOT/scripts/VerifyAdminClientCoverage.mjs" \
  --backend-root "$ROOT/../backend" \
  --client-root "$ROOT"
node "$ROOT/scripts/VerifyClientArchitecture.mjs"

cxx_build "${COMMON_FLAGS[@]}" \
  "$ROOT/tests/UpdateTrustPolicyTests.cpp" \
  "$ROOT/src/modules/update/domain/UpdateTrustPolicy.cpp" \
  -o "$BUILD_DIR/update-trust-policy-tests"
"$BUILD_DIR/update-trust-policy-tests"

cxx_build "${COMMON_FLAGS[@]}" -I"$JSON_INCLUDE" \
  "$ROOT/tests/UpdateProtocolTests.cpp" \
  "$ROOT/src/modules/update/domain/UpdateProtocol.cpp" \
  -o "$BUILD_DIR/update-protocol-tests"
"$BUILD_DIR/update-protocol-tests"

cxx_build "${COMMON_FLAGS[@]}" -pthread -I"$JSON_INCLUDE" \
  "$ROOT/tests/GameplayContractTests.cpp" \
  "$ROOT/src/modules/gameplay/actions/application/GameActionPresentationPolicy.cpp" \
  "$ROOT/src/modules/gameplay/actions/infrastructure/GameActionCatalogDecoder.cpp" \
  "$ROOT/src/modules/gameplay/cards/application/GameCardActionResolver.cpp" \
  "$ROOT/src/modules/gameplay/cards/application/GameCardTextBuilder.cpp" \
  "$ROOT/src/modules/gameplay/cards/infrastructure/GameCardDecoder.cpp" \
  "$ROOT/src/modules/gameplay/dice/application/GameDiceActionResolver.cpp" \
  "$ROOT/src/modules/gameplay/dice/application/GameDiceTextBuilder.cpp" \
  "$ROOT/src/modules/gameplay/dice/infrastructure/GameDiceDecoder.cpp" \
  "$ROOT/src/modules/gameplay/prompts/application/GamePromptInputCodec.cpp" \
  "$ROOT/src/modules/gameplay/prompts/application/GameActionPromptFactory.cpp" \
  "$ROOT/src/modules/gameplay/session/infrastructure/GameCommandPayloadCodec.cpp" \
  "$ROOT/src/modules/gameplay/session/infrastructure/GameEventPayloadCodec.cpp" \
  "$ROOT/src/modules/gameplay/history/presentation/GameLogCursor.cpp" \
  "$ROOT/src/modules/gameplay/grid/application/GameGridActionResolver.cpp" \
  "$ROOT/src/modules/gameplay/information/application/GameCapabilityTextBuilder.cpp" \
  "$ROOT/src/modules/gameplay/information/application/GameAssetCapabilityText.cpp" \
  "$ROOT/src/modules/gameplay/information/application/GameBoardCapabilityText.cpp" \
  "$ROOT/src/modules/gameplay/information/application/GameValueCapabilityText.cpp" \
  "$ROOT/src/modules/gameplay/information/application/GameValueTextBuilder.cpp" \
  "$ROOT/src/modules/gameplay/information/application/GameWorkflowCapabilityText.cpp" \
  "$ROOT/src/modules/gameplay/events/presentation/GameEventPresenter.cpp" \
  "$ROOT/src/modules/gameplay/state/infrastructure/GameAssetCapabilitiesDecoder.cpp" \
  "$ROOT/src/modules/gameplay/state/infrastructure/GameBoardCapabilitiesDecoder.cpp" \
  "$ROOT/src/modules/gameplay/state/infrastructure/GamePayloadJsonReader.cpp" \
  "$ROOT/src/modules/gameplay/state/infrastructure/GamePendingDecoder.cpp" \
  "$ROOT/src/modules/gameplay/state/infrastructure/GamePlayerValuesDecoder.cpp" \
  "$ROOT/src/modules/gameplay/state/infrastructure/GameStateSectionsDecoder.cpp" \
  "$ROOT/src/modules/gameplay/state/infrastructure/GameStatePayloadCodec.cpp" \
  "$ROOT/src/modules/gameplay/state/infrastructure/GameSystemDecoder.cpp" \
  "$ROOT/src/modules/gameplay/state/infrastructure/GameValueDecoder.cpp" \
  "$ROOT/src/modules/gameplay/state/infrastructure/GameWorkflowCapabilitiesDecoder.cpp" \
  "$ROOT/src/modules/gameplay/state/domain/GameKits.cpp" \
  "$ROOT/src/modules/gameplay/state/domain/GameSystem.cpp" \
  "$ROOT/src/modules/gameplay/pawn_selection/infrastructure/PawnSelectionDecoder.cpp" \
  -o "$BUILD_DIR/gameplay-contract-tests"
"$BUILD_DIR/gameplay-contract-tests"

cxx_build "${COMMON_FLAGS[@]}" -I"$JSON_INCLUDE" \
  "$ROOT/tests/RoomContractTests.cpp" \
  "$ROOT/src/modules/rooms/infrastructure/RoomInvitationPayloadCodec.cpp" \
  "$ROOT/src/modules/rooms/infrastructure/TableAmbiencePayloadCodec.cpp" \
  "$ROOT/src/modules/rooms/presentation/shortcuts/RoomShortcutPolicy.cpp" \
  "$ROOT/src/modules/rooms/presentation/actions/RoomActionPolicy.cpp" \
  -o "$BUILD_DIR/room-contract-tests"
"$BUILD_DIR/room-contract-tests"

cxx_build "${COMMON_FLAGS[@]}" -pthread -I"$JSON_INCLUDE" -I"$BUILD_DIR/generated" \
  "$ROOT/tests/ServiceResilienceTests.cpp" \
  "$ROOT/src/modules/rooms/application/RoomInvitationMonitor.cpp" \
  "$ROOT/src/modules/rooms/infrastructure/RoomInvitationPayloadCodec.cpp" \
  "$ROOT/src/modules/presence/application/PresenceMonitor.cpp" \
  "$ROOT/src/modules/presence/application/PresenceMonitor.Activity.cpp" \
  "$ROOT/src/modules/presence/infrastructure/PresencePayloadCodec.cpp" \
  "$ROOT/src/modules/chat/application/ChatService.cpp" \
  "$ROOT/src/modules/chat/application/ChatService.Connection.cpp" \
  "$ROOT/src/modules/chat/application/ChatService.Heartbeat.cpp" \
  "$ROOT/src/modules/chat/application/ChatService.Messages.cpp" \
  "$ROOT/src/modules/chat/application/ChatService.Reconnect.cpp" \
  "$ROOT/src/modules/chat/application/ChatMessageStore.cpp" \
  "$ROOT/src/modules/gameplay/session/application/GameSessionService.cpp" \
  "$ROOT/src/modules/options/application/OptionsStore.cpp" \
  "$ROOT/src/modules/rooms/application/RoomSessionService.cpp" \
  "$ROOT/src/modules/rooms/application/RoomSessionService.Realtime.cpp" \
  "$ROOT/src/modules/session/application/SessionStore.cpp" \
  "$ROOT/src/modules/session/application/SessionStore.Refresh.cpp" \
  "$ROOT/src/modules/session/application/SessionStore.Revocation.cpp" \
  "$ROOT/src/shared/concurrency/application/BackgroundExecutor.cpp" \
  "$ROOT/src/shared/concurrency/application/BackgroundTasks.cpp" \
  "$ROOT/src/shared/config/domain/AppConfig.cpp" \
  "$ROOT/src/shared/logging/infrastructure/Logger.cpp" \
  "$ROOT/src/shared/network/application/realtime/ReconnectPolicy.cpp" \
  "$ROOT/src/shared/security/domain/JwtPayload.cpp" \
  "$ROOT/src/shared/security/infrastructure/SecurityUtils.cpp" \
  -o "$BUILD_DIR/service-resilience-tests"
(
  cd "$BUILD_DIR"
  ./service-resilience-tests
)

cxx_build "${COMMON_FLAGS[@]}" \
  "$ROOT/tests/SocialProfileMapperTests.cpp" \
  -o "$BUILD_DIR/social-profile-mapper-tests"
"$BUILD_DIR/social-profile-mapper-tests"

cxx_build "${COMMON_FLAGS[@]}" \
  "$ROOT/tests/ChatErrorResolverTests.cpp" \
  -o "$BUILD_DIR/chat-error-resolver-tests"
"$BUILD_DIR/chat-error-resolver-tests"

cxx_build "${COMMON_FLAGS[@]}" -pthread -I"$JSON_INCLUDE" -I"$BUILD_DIR/generated" \
  "$ROOT/tests/RealtimeRequestDeadlineTests.cpp" \
  "$ROOT/src/shared/config/domain/AppConfig.cpp" \
  "$ROOT/src/shared/network/application/realtime/AuthenticatedRealtimeApiClient.cpp" \
  "$ROOT/src/shared/network/application/realtime/RealtimeProtocol.cpp" \
  "$ROOT/src/shared/network/application/realtime/ReconnectPolicy.cpp" \
  -o "$BUILD_DIR/realtime-request-deadline-tests"
"$BUILD_DIR/realtime-request-deadline-tests"

cxx_build "${COMMON_FLAGS[@]}" -c \
  "$ROOT/tests/PresentationControllerCompileTests.cpp" \
  -o "$BUILD_DIR/presentation-controller-compile-tests.o"

cxx_build "${COMMON_FLAGS[@]}" -c \
  "$ROOT/src/modules/messaging/presentation/MessagingActionController.cpp" \
  -o "$BUILD_DIR/messaging-action-controller-compile-tests.o"

if rg -n -i '\blama\b' "$ROOT/src"; then
  echo "Le client WX ne doit contenir aucune logique propre à LAMA." >&2
  exit 1
fi

if rg -n 'event\.type[[:space:]]*==' \
    "$ROOT/src/modules/gameplay/events/presentation/GameEventPresenter.cpp"; then
  echo "Les annonces de jeu doivent être rédigées par le backend." >&2
  exit 1
fi

if rg -n 'HandleZoneKey|HandleGlobalShortcut' "$ROOT/src/modules"; then
  echo "La saisie de jeu WX doit passer par un routeur unique." >&2
  exit 1
fi

if rg -n 'if \(!roomStarted_\) return true;' \
    "$ROOT/src/modules/gameplay/shell/presentation/panel/GamePlayPanel.Input.cpp"; then
  echo "La transition de demarrage WX ne doit pas avaler toutes les touches." >&2
  exit 1
fi

echo "Portable checks passed."

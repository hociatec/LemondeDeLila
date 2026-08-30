#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_DIR="${TMPDIR:-/tmp}/lila-portable-tests"
mkdir -p "$BUILD_DIR"
COMMON_FLAGS=(-std=c++20 -Wall -Wextra -Wpedantic -Werror -I"$ROOT/src")
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

sed \
  -e 's/@PROJECT_VERSION@/portable-test/g' \
  -e 's/@PROJECT_VERSION_MAJOR@/0/g' \
  -e 's/@PROJECT_VERSION_MINOR@/0/g' \
  -e 's/@PROJECT_VERSION_PATCH@/0/g' \
  "$ROOT/src/shared/config/generated/AppBuildInfo.h.in" \
  > "$BUILD_DIR/generated/AppBuildInfo.h"

c++ "${COMMON_FLAGS[@]}" \
  "$ROOT/tests/UrlUtilsTests.cpp" \
  -o "$BUILD_DIR/url-utils-tests"
"$BUILD_DIR/url-utils-tests"

c++ "${COMMON_FLAGS[@]}" -pthread \
  "$ROOT/tests/BackgroundExecutorTests.cpp" \
  "$ROOT/src/shared/concurrency/application/BackgroundExecutor.cpp" \
  "$ROOT/src/shared/concurrency/application/BackgroundTasks.cpp" \
  "$ROOT/src/shared/logging/infrastructure/Logger.cpp" \
  -o "$BUILD_DIR/background-executor-tests"
"$BUILD_DIR/background-executor-tests"

c++ "${COMMON_FLAGS[@]}" \
  "$ROOT/tests/SocialDataStoreTests.cpp" \
  "$ROOT/src/modules/social/presentation/SocialDataStore.cpp" \
  -o "$BUILD_DIR/social-data-store-tests"
"$BUILD_DIR/social-data-store-tests"

c++ "${COMMON_FLAGS[@]}" \
  "$ROOT/tests/MessagingSelectionMemoryTests.cpp" \
  "$ROOT/src/modules/messaging/presentation/MessagingSelectionMemory.cpp" \
  -o "$BUILD_DIR/messaging-selection-memory-tests"
"$BUILD_DIR/messaging-selection-memory-tests"

c++ "${COMMON_FLAGS[@]}" \
  "$ROOT/tests/NavigationStateTests.cpp" \
  -o "$BUILD_DIR/navigation-state-tests"
"$BUILD_DIR/navigation-state-tests"

c++ "${COMMON_FLAGS[@]}" \
  "$ROOT/tests/UpdateTrustPolicyTests.cpp" \
  "$ROOT/src/modules/update/domain/UpdateTrustPolicy.cpp" \
  -o "$BUILD_DIR/update-trust-policy-tests"
"$BUILD_DIR/update-trust-policy-tests"

c++ "${COMMON_FLAGS[@]}" -I"$JSON_INCLUDE" \
  "$ROOT/tests/UpdateProtocolTests.cpp" \
  "$ROOT/src/modules/update/domain/UpdateProtocol.cpp" \
  -o "$BUILD_DIR/update-protocol-tests"
"$BUILD_DIR/update-protocol-tests"

c++ "${COMMON_FLAGS[@]}" -pthread -I"$JSON_INCLUDE" \
  "$ROOT/tests/GameplayContractTests.cpp" \
  "$ROOT/src/modules/gameplay/actions/application/GameActionPresentationPolicy.cpp" \
  "$ROOT/src/modules/gameplay/actions/infrastructure/GameActionCatalogDecoder.cpp" \
  "$ROOT/src/modules/gameplay/cards/application/GameCardActionResolver.cpp" \
  "$ROOT/src/modules/gameplay/cards/application/GameCardTextBuilder.cpp" \
  "$ROOT/src/modules/gameplay/cards/infrastructure/GameCardDecoder.cpp" \
  "$ROOT/src/modules/gameplay/dice/application/GameDiceActionResolver.cpp" \
  "$ROOT/src/modules/gameplay/dice/application/GameDiceRollTracker.cpp" \
  "$ROOT/src/modules/gameplay/dice/application/GameDiceTextBuilder.cpp" \
  "$ROOT/src/modules/gameplay/dice/infrastructure/GameDiceDecoder.cpp" \
  "$ROOT/src/modules/gameplay/prompts/application/GamePromptInputCodec.cpp" \
  "$ROOT/src/modules/gameplay/prompts/application/GameActionPromptFactory.cpp" \
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

c++ "${COMMON_FLAGS[@]}" -I"$JSON_INCLUDE" \
  "$ROOT/tests/RoomContractTests.cpp" \
  "$ROOT/src/modules/rooms/infrastructure/RoomInvitationPayloadCodec.cpp" \
  "$ROOT/src/modules/rooms/infrastructure/TableAmbiencePayloadCodec.cpp" \
  "$ROOT/src/modules/rooms/presentation/shortcuts/RoomShortcutPolicy.cpp" \
  "$ROOT/src/modules/rooms/presentation/actions/RoomActionPolicy.cpp" \
  -o "$BUILD_DIR/room-contract-tests"
"$BUILD_DIR/room-contract-tests"

c++ "${COMMON_FLAGS[@]}" -pthread -I"$JSON_INCLUDE" -I"$BUILD_DIR/generated" \
  "$ROOT/tests/ServiceResilienceTests.cpp" \
  "$ROOT/src/modules/chat/application/ChatService.cpp" \
  "$ROOT/src/modules/chat/application/ChatService.Connection.cpp" \
  "$ROOT/src/modules/chat/application/ChatService.Messages.cpp" \
  "$ROOT/src/modules/chat/application/ChatService.Reconnect.cpp" \
  "$ROOT/src/modules/chat/application/ChatMessageStore.cpp" \
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
  "$ROOT/src/shared/security/domain/JwtPayload.cpp" \
  "$ROOT/src/shared/security/infrastructure/SecurityUtils.cpp" \
  -o "$BUILD_DIR/service-resilience-tests"
(
  cd "$BUILD_DIR"
  ./service-resilience-tests
)

c++ "${COMMON_FLAGS[@]}" \
  "$ROOT/tests/SocialProfileMapperTests.cpp" \
  -o "$BUILD_DIR/social-profile-mapper-tests"
"$BUILD_DIR/social-profile-mapper-tests"

c++ "${COMMON_FLAGS[@]}" \
  "$ROOT/tests/ChatErrorResolverTests.cpp" \
  -o "$BUILD_DIR/chat-error-resolver-tests"
"$BUILD_DIR/chat-error-resolver-tests"

c++ "${COMMON_FLAGS[@]}" -pthread -I"$JSON_INCLUDE" -I"$BUILD_DIR/generated" \
  "$ROOT/tests/RealtimeRequestDeadlineTests.cpp" \
  "$ROOT/src/shared/config/domain/AppConfig.cpp" \
  "$ROOT/src/shared/network/application/realtime/AuthenticatedRealtimeApiClient.cpp" \
  "$ROOT/src/shared/network/application/realtime/RealtimeProtocol.cpp" \
  -o "$BUILD_DIR/realtime-request-deadline-tests"
"$BUILD_DIR/realtime-request-deadline-tests"

c++ "${COMMON_FLAGS[@]}" -c \
  "$ROOT/tests/PresentationControllerCompileTests.cpp" \
  -o "$BUILD_DIR/presentation-controller-compile-tests.o"

c++ "${COMMON_FLAGS[@]}" -c \
  "$ROOT/src/modules/messaging/presentation/MessagingActionController.cpp" \
  -o "$BUILD_DIR/messaging-action-controller-compile-tests.o"

if rg -n -i '\blama\b' "$ROOT/src"; then
  echo "Le client WX ne doit contenir aucune logique propre à LAMA." >&2
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

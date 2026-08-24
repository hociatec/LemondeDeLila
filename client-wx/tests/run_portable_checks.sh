#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_DIR="${TMPDIR:-/tmp}/lila-portable-tests"
mkdir -p "$BUILD_DIR"

c++ -std=c++20 -I"$ROOT/src" \
  "$ROOT/tests/UrlUtilsTests.cpp" \
  -o "$BUILD_DIR/url-utils-tests"
"$BUILD_DIR/url-utils-tests"

c++ -std=c++20 -pthread -I"$ROOT/src" \
  "$ROOT/tests/BackgroundExecutorTests.cpp" \
  "$ROOT/src/shared/concurrency/application/BackgroundExecutor.cpp" \
  -o "$BUILD_DIR/background-executor-tests"
"$BUILD_DIR/background-executor-tests"

c++ -std=c++20 -I"$ROOT/src" \
  "$ROOT/tests/SocialDataStoreTests.cpp" \
  -o "$BUILD_DIR/social-data-store-tests"
"$BUILD_DIR/social-data-store-tests"

c++ -std=c++20 -I"$ROOT/src" \
  "$ROOT/tests/MessagingSelectionMemoryTests.cpp" \
  -o "$BUILD_DIR/messaging-selection-memory-tests"
"$BUILD_DIR/messaging-selection-memory-tests"

c++ -std=c++20 -I"$ROOT/src" \
  "$ROOT/tests/NavigationStateTests.cpp" \
  -o "$BUILD_DIR/navigation-state-tests"
"$BUILD_DIR/navigation-state-tests"

c++ -std=c++20 -I"$ROOT/src" \
  "$ROOT/tests/SocialProfileMapperTests.cpp" \
  -o "$BUILD_DIR/social-profile-mapper-tests"
"$BUILD_DIR/social-profile-mapper-tests"

c++ -std=c++20 -I"$ROOT/src" \
  "$ROOT/tests/ChatErrorResolverTests.cpp" \
  -o "$BUILD_DIR/chat-error-resolver-tests"
"$BUILD_DIR/chat-error-resolver-tests"

c++ -std=c++20 -I"$ROOT/src" -c \
  "$ROOT/tests/PresentationControllerCompileTests.cpp" \
  -o "$BUILD_DIR/presentation-controller-compile-tests.o"

echo "Portable checks passed."

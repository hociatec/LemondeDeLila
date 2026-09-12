#!/usr/bin/env bash
set -euo pipefail

TEST_ROOT="$(mktemp -d)"
trap 'rm -rf -- "$TEST_ROOT"' EXIT

# shellcheck source=../lib/common.sh
# shellcheck disable=SC1091
source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)/lib/common.sh"
# shellcheck source=../lib/wx.sh
# shellcheck disable=SC1091
source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)/lib/wx.sh"

RUN_DIR="$TEST_ROOT/run"
mkdir -p "$RUN_DIR"
WX_MANIFEST_PRIVATE_KEY="$TEST_ROOT/private.pem"
WX_RELEASE_ID="local-1.2.3-source"
WX_VERSION="1.2.3"
WX_SEQUENCE=123
WX_PUBLISHED_AT="2026-09-12T23:52:46.000Z"
WX_MANDATORY_AT=""
WX_MINIMUM_VERSION=""
export WX_MANDATORY_AT WX_MINIMUM_VERSION
WX_ARTIFACT_SIZE=456
WX_ARTIFACT_SHA256="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
WX_INSTALLER_SHA256="bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"

openssl genpkey -quiet -algorithm RSA -pkeyopt rsa_keygen_bits:2048 \
  -out "$WX_MANIFEST_PRIVATE_KEY"
sign_wx_manifest

EXPECTED_CANONICAL="$(printf '%s' "lila-client-wx-manifest-v2
product=client-wx
platform=windows
architecture=x64
channel=stable
releaseId=$WX_RELEASE_ID
version=$WX_VERSION
sequence=$WX_SEQUENCE
publishedAt=$WX_PUBLISHED_AT
mandatoryAt=-
minimumVersion=-
artifactSize=$WX_ARTIFACT_SIZE
artifactSha256=$WX_ARTIFACT_SHA256
installerSha256=$WX_INSTALLER_SHA256")"
ACTUAL_CANONICAL="$(<"$RUN_DIR/wx-manifest-canonical.txt")"
[[ "$ACTUAL_CANONICAL" == "$EXPECTED_CANONICAL" ]] \
  || die "Le contrat de signature WX ne correspond plus au backend."

openssl dgst -sha256 \
  -verify <(openssl pkey -in "$WX_MANIFEST_PRIVATE_KEY" -pubout) \
  -signature "$RUN_DIR/wx-manifest.sig" \
  "$RUN_DIR/wx-manifest-canonical.txt" >/dev/null

printf 'updatecmd WX signature contract tests passed.\n'

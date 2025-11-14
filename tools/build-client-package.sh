#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="$ROOT_DIR/backend/var/updates"
ARCHIVE_NAME="le-monde-de-lila-client.zip"
STAGING_DIR="$(mktemp -d)"
PACKAGE_ROOT="$STAGING_DIR/le-monde-de-lila-client"

cleanup() {
  rm -rf "$STAGING_DIR"
}
trap cleanup EXIT

mkdir -p "$PACKAGE_ROOT"

echo "[package] Préparation des sources client..."
rsync -a --exclude 'target/' "$ROOT_DIR/java-client/" "$PACKAGE_ROOT/java-client/"
cp "$ROOT_DIR/start-lila.ps1" "$PACKAGE_ROOT/"
mkdir -p "$PACKAGE_ROOT/logs"

mkdir -p "$OUTPUT_DIR"
echo "[package] Construction de l'archive..."
if command -v zip >/dev/null 2>&1; then
  (cd "$STAGING_DIR" && zip -qr "$OUTPUT_DIR/$ARCHIVE_NAME" "le-monde-de-lila-client")
else
  (cd "$STAGING_DIR" && python3 -m zipfile -c "$OUTPUT_DIR/$ARCHIVE_NAME" "le-monde-de-lila-client")
fi
echo "[package] Archive disponible : $OUTPUT_DIR/$ARCHIVE_NAME"

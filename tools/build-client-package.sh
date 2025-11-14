#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="$ROOT_DIR/backend/public/downloads"
ARCHIVE_NAME="le-monde-de-lila-client.zip"

mkdir -p "$OUTPUT_DIR"

echo "[package] Building client archive from $(git -C "$ROOT_DIR" rev-parse --short HEAD)"
git -C "$ROOT_DIR" archive --format=zip --worktree-attributes --prefix=lemondeDeLila/ HEAD > "$OUTPUT_DIR/$ARCHIVE_NAME"
echo "[package] Archive ready at $OUTPUT_DIR/$ARCHIVE_NAME"

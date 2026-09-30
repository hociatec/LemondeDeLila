#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LILA_INCLUDE_STRESS=1 exec bash "$ROOT/tests/run_portable_checks.sh"

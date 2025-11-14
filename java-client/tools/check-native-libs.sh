#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LIB_DIR="$ROOT_DIR/libs/windows"
MISSING=0

check_arch() {
  local arch_dir=$1
  local dll=$2
  local path="$LIB_DIR/$arch_dir/$dll"
  if [[ ! -f "$path" ]]; then
    echo "[WARN] DLL absente : $path"
    MISSING=1
  fi
}

check_arch x64 nvdaHelperRemote.dll
check_arch x64 nvdaControllerClient64.dll
check_arch x64 SAAPI32.dll
check_arch x86 nvdaHelperRemote.dll
check_arch x86 nvdaControllerClient32.dll
check_arch x86 SAAPI32.dll

if [[ $MISSING -eq 1 ]]; then
  echo "Certaines bibliothèques natives sont manquantes. Vérifiez votre packaging."
  exit 1
fi

echo "Bibliothèques NVDA/JAWS détectées pour x64 et x86."

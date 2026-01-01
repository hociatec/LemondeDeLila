#!/usr/bin/env bash
set -euo pipefail

# Generates an RSA keypair for JWT signing (RS256).
# Output:
#   - backend/keys/jwt-private.pem (server only)
#   - backend/keys/jwt-public.pem  (can be shipped to clients)

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="${ROOT_DIR}/keys"

mkdir -p "${OUT_DIR}"

openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "${OUT_DIR}/jwt-private.pem"
openssl rsa -pubout -in "${OUT_DIR}/jwt-private.pem" -out "${OUT_DIR}/jwt-public.pem"

echo "Generated:"
echo "  ${OUT_DIR}/jwt-private.pem"
echo "  ${OUT_DIR}/jwt-public.pem"

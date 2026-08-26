#!/usr/bin/env bash
set -euo pipefail

usage() {
  printf 'Usage: sudo %s CERTIFICAT.pfx\n' "$0" >&2
  printf '   ou: sudo %s CLE_MANIFESTE_PRIVEE.pem CERTIFICAT.pfx\n' "$0" >&2
  exit 2
}

[[ "$(id -u)" -eq 0 ]] || { echo "Cette commande doit être exécutée avec sudo." >&2; exit 1; }
SECRET_DIR=/etc/lemonde-de-lila/secrets
if [[ $# -eq 1 ]]; then
  MANIFEST_KEY="$SECRET_DIR/wx-update-private.pem"
  PFX_PATH="$1"
elif [[ $# -eq 2 ]]; then
  MANIFEST_KEY="$1"
  PFX_PATH="$2"
else
  usage
fi
[[ -s "$MANIFEST_KEY" && -s "$PFX_PATH" ]] || { echo "Clé PEM ou PFX absent/vide." >&2; exit 1; }

read -r -s -p 'Mot de passe du PFX: ' PFX_PASSWORD
printf '\n'
[[ -n "$PFX_PASSWORD" ]] || { echo "Mot de passe vide refusé." >&2; exit 1; }
export PFX_PASSWORD

install -d -m 0700 "$SECRET_DIR"
openssl pkey -in "$MANIFEST_KEY" -check -noout >/dev/null
CERTIFICATE_PEM="$(mktemp)"
CERTIFICATE_DER="$(mktemp)"
_temporary_path=""
trap 'for _temporary_path in "${CERTIFICATE_PEM:-}" "${CERTIFICATE_DER:-}" "${ENV_TEMP:-}"; do [[ -z "$_temporary_path" ]] || rm -f "$_temporary_path"; done' EXIT
openssl pkcs12 -in "$PFX_PATH" -passin env:PFX_PASSWORD -clcerts -nokeys -out "$CERTIFICATE_PEM"
openssl x509 -in "$CERTIFICATE_PEM" -outform DER -out "$CERTIFICATE_DER"
ACTUAL_SIGNER_SHA256="$(sha256sum "$CERTIFICATE_DER" | awk '{print tolower($1)}')"
EXPECTED_SIGNER_SHA256="$(sed -n 's/^WX_EXPECTED_SIGNER_SHA256=//p' /etc/lemonde-de-lila/updatecmd.conf 2>/dev/null | tail -n 1)"
EXPECTED_SIGNER_SHA256="${EXPECTED_SIGNER_SHA256,,}"
if [[ -n "$EXPECTED_SIGNER_SHA256" && "$ACTUAL_SIGNER_SHA256" != "$EXPECTED_SIGNER_SHA256" ]]; then
  echo "Le PFX ne correspond pas au certificat épinglé par les clients." >&2
  echo "Attendu: $EXPECTED_SIGNER_SHA256" >&2
  echo "Obtenu: $ACTUAL_SIGNER_SHA256" >&2
  exit 1
fi

if [[ -s "$SECRET_DIR/wx-update-private.pem" ]]; then
  EXISTING_PUBLIC_SHA256="$(openssl pkey -in "$SECRET_DIR/wx-update-private.pem" -pubout -outform DER | sha256sum | awk '{print $1}')"
  IMPORTED_PUBLIC_SHA256="$(openssl pkey -in "$MANIFEST_KEY" -pubout -outform DER | sha256sum | awk '{print $1}')"
  [[ "$EXISTING_PUBLIC_SHA256" == "$IMPORTED_PUBLIC_SHA256" ]] \
    || { echo "Rotation de la clé de manifeste refusée: les clients existants la rejèteraient." >&2; exit 1; }
fi

if [[ "$(readlink -f "$MANIFEST_KEY")" != "$SECRET_DIR/wx-update-private.pem" ]]; then
  install -m 0600 "$MANIFEST_KEY" "$SECRET_DIR/wx-update-private.pem"
fi
install -m 0600 "$PFX_PATH" "$SECRET_DIR/wx-codesign.pfx"
printf '%s\n' "$PFX_PASSWORD" >"$SECRET_DIR/wx-codesign-password"
chmod 0600 "$SECRET_DIR/wx-codesign-password"

PUBLIC_KEY_DER_BASE64="$(openssl pkey -in "$MANIFEST_KEY" -pubout -outform DER | base64 -w 0)"
BACKEND_ENV=/etc/lemonde-de-lila/backend.env
if [[ -f "$BACKEND_ENV" ]]; then
  ENV_TEMP="$(mktemp)"
  awk '!/^CLIENT_WX_SIGNATURE_PUBLIC_KEY_DER_BASE64=/' "$BACKEND_ENV" >"$ENV_TEMP"
  printf 'CLIENT_WX_SIGNATURE_PUBLIC_KEY_DER_BASE64=%s\n' "$PUBLIC_KEY_DER_BASE64" >>"$ENV_TEMP"
  install -m 0640 --owner root --group "$(stat -c '%G' "$BACKEND_ENV")" "$ENV_TEMP" "$BACKEND_ENV"
fi
unset PFX_PASSWORD
echo "Secrets de signature installés. Lancez: sudo updatecmd doctor"

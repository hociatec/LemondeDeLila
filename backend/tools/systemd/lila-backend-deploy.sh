#!/usr/bin/env bash
set -euo pipefail

# Compatibilité avec l'API d'administration existante. updatecmd prend un
# instantané local, construit une release séparée, bascule atomiquement et ne
# contacte jamais Git.
exec /usr/local/sbin/updatecmd backend

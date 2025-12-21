#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

log() {
  printf '[deploy] %s\n' "$1"
}

log "Pull latest code (fast-forward only)"
git pull --ff-only

log "Install backend dependencies"
cd backend
npm ci

log "Build backend (NestJS)"
npm run build

log "Run database migrations (prod)"
npm run migration:run

log "Restart backend services"
# Adapter ces services à votre stack (pm2, docker, systemd…)
cd "$ROOT_DIR"
sudo systemctl restart lila-backend.service
sudo systemctl restart lila-realtime.service

log "Deployment completed"

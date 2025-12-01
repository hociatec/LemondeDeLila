#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

log() {
  printf '[deploy] %s\n' "$1"
}

log "Pull latest code (fast-forward only)"
git pull --ff-only

log "Install PHP dependencies (no-dev, optimized autoloader)"
cd backend
composer install --no-dev --optimize-autoloader

log "Run database migrations (prod)"
php8.2 bin/console doctrine:migrations:migrate --no-interaction --env=prod

log "Clear and warm Symfony cache (prod)"
php8.2 bin/console cache:clear --env=prod
php8.2 bin/console cache:warmup --env=prod

log "Restart realtime and PHP-FPM, reload nginx"
sudo systemctl restart lila-realtime.service
sudo systemctl restart php8.2-fpm
sudo systemctl reload nginx

log "Deployment completed"

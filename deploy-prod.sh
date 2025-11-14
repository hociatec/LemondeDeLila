#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="/home/ubuntu/lemondeDeLila"
BACKEND_DIR="$ROOT_DIR/backend"

echo "[deploy] Mise à jour de la branche courante..."
cd "$ROOT_DIR"
git pull --ff-only

echo "[deploy] Installation des dépendances PHP (prod)..."
cd "$BACKEND_DIR"
composer install --no-dev --optimize-autoloader

echo "[deploy] Migration de la base..."
php8.2 bin/console doctrine:migrations:migrate --no-interaction --env=prod

echo "[deploy] Nettoyage et préchauffage du cache..."
php8.2 bin/console cache:clear --env=prod
php8.2 bin/console cache:warmup --env=prod

echo "[deploy] Redémarrage des services..."
sudo systemctl restart lila-realtime.service
sudo systemctl restart php8.2-fpm
sudo systemctl reload nginx

echo "[deploy] Terminé."

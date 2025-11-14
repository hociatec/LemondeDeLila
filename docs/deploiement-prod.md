# Déploiement production – Le Monde de Lila

## Services systèmes

| Service | Rôle | Commandes utiles |
|---------|------|------------------|
| `nginx` | Reverse-proxy HTTPS pour `hociatec.fr` et `api.hociatec.fr`. Sert Symfony et relaie les WebSockets pour `wss://hociatec.fr`. | `sudo systemctl reload nginx` |
| `php8.2-fpm` | Pools PHP pour les requêtes HTTP/API. | `sudo systemctl restart php8.2-fpm` |
| `lila-realtime.service` | Lance `bin/console app:realtime:serve --env=prod` (WebSocket/push). | `sudo systemctl restart|status lila-realtime.service` |
| `lila-backend.service` | Service one-shot qui préchauffe le cache Symfony au boot. | `sudo systemctl start lila-backend.service` |

Les journaux applicatifs sont écrits dans `logs/backend-http*.log` (HTTP), `logs/backend-realtime*.log` (WS) et dans les logs système (`journalctl -u lila-realtime`).

## Script de déploiement

Le script `deploy-prod.sh` automatise les tâches suivantes :

1. `git pull --ff-only`
2. `composer install --no-dev --optimize-autoloader`
3. `php8.2 bin/console doctrine:migrations:migrate --no-interaction --env=prod`
4. Nettoyage et warmup du cache (`cache:clear`, `cache:warmup`)
5. Redémarrage des services critiques (`lila-realtime`, `php8.2-fpm`, rechargement Nginx)

Exécution :

```bash
cd /home/ubuntu/lemondeDeLila
./deploy-prod.sh
```

Le script suppose que l’utilisateur courant peut exécuter `sudo systemctl` sans mot de passe.

## Configuration réseau

- `hociatec.fr`, `www.hociatec.fr` et `api.hociatec.fr` pointent vers `/home/ubuntu/lemondeDeLila/backend/public` via HTTPS (TLS Let’s Encrypt).
- `hociatec.fr` relaie aussi les WebSockets (`wss://hociatec.fr`) vers `http://127.0.0.1:8081`, avec les en-têtes nécessaires (`Upgrade`, `Connection`, `X-Forwarded-*`).
- Le backend répond maintenant sur `/` avec un JSON de santé (`App\Module\Core\Controller\LandingController`), ce qui évite les 404 pour les vérifications simples.

### Client Java

- Le fichier `java-client/client-app/src/main/resources/config/client.properties` pointe désormais sur la production :
  - `network.http.base=https://hociatec.fr/api/`
  - `network.ws.url=wss://hociatec.fr/ws`
  - `network.ws.presence=wss://hociatec.fr/presence`
- Les valeurs par défaut côté code (fallbacks) ont été alignées, ce qui permet d’utiliser le client sans modification locale.
- Les variables `APP_CLIENT_VERSION` / `APP_CLIENT_DOWNLOAD_URL` (définies dans `.env*`) alimentent l’endpoint `/client/version` : le client Swing s’en sert pour le bouton “Vérifier/Installer les mises à jour”. Le fichier ZIP est généré localement via `./tools/build-client-package.sh` et exposé par Nginx (`https://hociatec.fr/downloads/le-monde-de-lila-client.zip`).
- `updates.check.url` contrôle l’URL interrogée côté client (`client.properties`). Par défaut : `https://hociatec.fr/client/version`.

Vérifications rapides :

```bash
curl https://hociatec.fr/
curl -I https://hociatec.fr/api
curl -I https://hociatec.fr/ws
systemctl status lila-realtime.service
```

## Secrets et variables d’environnement

- Les paramètres prod sont compilés dans `backend/.env.local.php` (généré via `composer dump-env prod`). Éviter de modifier directement `.env.local`; passer par les variables système si besoin.
- Les clés JWT ont été régénérées (`backend/config/jwt/*`). Conserver les fichiers synchronisés entre instances si vous déployez sur plusieurs serveurs.

## Procédure de reprise

1. Vérifier la base MySQL (`mysql -u admin -p -D les_mondes_de_lilas -e "SELECT 1"`).
2. Relancer `lila-realtime.service` et `php8.2-fpm` si nécessaire.
3. Contrôler les certificats via `sudo certbot certificates` (renouvellement automatique configuré).
4. En cas de modification majeure, rejouer `./deploy-prod.sh`.

Pour toute évolution du reverse-proxy, modifier `/etc/nginx/sites-available/les_mondes_de_lilas.conf`, tester (`sudo nginx -t`) puis recharger.

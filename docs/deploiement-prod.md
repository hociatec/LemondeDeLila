# Déploiement production – Le Monde de Lila

## Services systèmes

| Service | Rôle | Commandes utiles |
|---------|------|------------------|
| `nginx` | Reverse-proxy HTTPS pour `lilas.hociatec.fr` (front), `api.lilas.hociatec.fr` (API) et `ws.lilas.hociatec.fr` (WebSocket). | `sudo systemctl reload nginx` |
| `php8.2-fpm` | Pools PHP pour les requêtes HTTP/API. | `sudo systemctl restart php8.2-fpm` |
| `lila-realtime.service` | Lance `bin/console app:realtime:serve --env=prod` (WebSocket/push). | `sudo systemctl restart|status lila-realtime.service` |
| `lila-backend.service` | Service one-shot qui préchauffe le cache Symfony au boot. | `sudo systemctl start lila-backend.service` |

Les journaux applicatifs sont écrits dans `backend/var/log/prod.log` (HTTP/WS) et `backend/var/log/deprecation.log`, et restent visibles via `journalctl -u lila-realtime` pour le service WebSocket.

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

- `lilas.hociatec.fr` pointe vers `/home/ubuntu/lemondeDeLila/backend/public` via HTTPS (TLS Let’s Encrypt).
- `api.lilas.hociatec.fr` pointe également vers `/home/ubuntu/lemondeDeLila/backend/public` pour l’API REST (`/api`).
- `ws.lilas.hociatec.fr` relaie les WebSockets (`/ws`, `/presence`) vers `http://127.0.0.1:8081`, avec les en-têtes nécessaires (`Upgrade`, `Connection`, `X-Forwarded-*`).
- Le backend répond maintenant sur `/` avec un JSON de santé (`App\Module\Core\Controller\LandingController`), ce qui évite les 404 pour les vérifications simples.

### Client Java / mises a jour

- Le fichier `java-client/client-app/src/main/resources/config/client.properties` pointe desormais sur la production :
  - `network.http.base=https://api.lilas.hociatec.fr/api/`
  - `network.ws.url=wss://ws.lilas.hociatec.fr/ws`
  - `network.ws.presence=wss://ws.lilas.hociatec.fr/presence`
- Les valeurs par defaut cote code (fallbacks) ont ete alignees, ce qui permet d'utiliser le client sans modification locale.
- Manifest `/client/version` (JSON) : `version`, `downloadUrl`, `checksum`, `timestamp`, `tokenRequired`, `tokenHeader`, `tokenQueryParameter` et maintenant :
  - `minSupportedVersion` (bloque le client si version locale < valeur)
  - `signatureUrl` (fichier de signature de l'artefact a verifier cote client)
  - `changelog` (array JSON libre, ex. liste de blocs `{version, highlights, fixes}`)
- Variables d'environnement associees (dans `.env*`) :
  - `APP_CLIENT_VERSION`, `APP_CLIENT_DOWNLOAD_URL`, `APP_CLIENT_CHECKSUM`, `APP_CLIENT_DOWNLOAD_SECRET`
  - `APP_CLIENT_MIN_VERSION` (optionnel)
  - `APP_CLIENT_SIGNATURE_URL` (URL du .sig/.p7s)
  - `APP_CLIENT_CHANGELOG` (JSON, ex. `[{"version":"1.2.4","highlights":["Nouveau launcher"],"fixes":["Correction NVDA"]}]`)
- Le ZIP client est genere via `./tools/build-client-package.sh` et depose en HTTPS (`backend/var/updates` par Nginx).
- `updates.check.url` controle l'URL interrogee cote client (`client.properties`). Par defaut : `https://api.lilas.hociatec.fr/client/version`.

## Secrets et variables d’environnement

- Les paramètres prod sont compilés dans `backend/.env.local.php` (généré via `composer dump-env prod`). Éviter de modifier directement `.env.local`; passer par les variables système si besoin.
- Les clés JWT ont été régénérées (`backend/config/jwt/*`). Conserver les fichiers synchronisés entre instances si vous déployez sur plusieurs serveurs.

## Procédure de reprise

1. Vérifier la base MySQL (`mysql -u admin -p -D les_mondes_de_lilas -e "SELECT 1"`).
2. Relancer `lila-realtime.service` et `php8.2-fpm` si nécessaire.
3. Contrôler les certificats via `sudo certbot certificates` (renouvellement automatique configuré).
4. En cas de modification majeure, rejouer `./deploy-prod.sh`.

Pour toute évolution du reverse-proxy, modifier `/etc/nginx/sites-available/les_mondes_de_lilas.conf`, tester (`sudo nginx -t`) puis recharger.

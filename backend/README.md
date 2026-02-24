# Backend – Le Monde de Lila

Plateforme NestJS qui gère les salons, le moteur de jeux, la messagerie et la présence temps réel.

## Prérequis

- Node.js 20+
- npm 10+
- MySQL 8 (ou MariaDB 10.6+, via `DATABASE_URL`)
- Redis (obligatoire en production pour les états de jeu et les sessions WS)

## Installation locale

```bash
cp .env.example .env          # renseigner JWT_* + URLs Redis
npm ci
npm run migration:run:dev     # crée/maj le schéma MySQL local
npm run start:dev             # API + gateways en mode watch
```

> Note (production/local) : si vous démarrez avec `NODE_ENV=production`, le backend charge aussi `.env` par défaut.
> Pour forcer un mode "env-only" (systemd/docker), définissez `IGNORE_ENV_FILE=true`.

### Générer des clés JWT RS256

```bash
./tools/jwt/generate-rsa-keys.sh
```

- Serveur: pointer `JWT_PRIVATE_KEY_PATH` et `JWT_PUBLIC_KEY_PATH` vers `backend/keys/jwt-*.pem`
- Client WPF: copier `backend/keys/jwt-public.pem` vers `config/jwt-signing-public.pem` et définir `jwt.signature.publicKey` dans `client.properties`
- Endpoint JWKS (clé publique): `GET /.well-known/jwks.json`

### Mise en place MySQL (dev)

Sur Ubuntu, le user `root` est souvent en `auth_socket` (pas de mot de passe), donc la connexion applicative doit utiliser un user dédié.

```bash
sudo mysql < backend/tools/sql/create-db-user.mysql.sql
```

### Sécurisation WS

Le backend peut exiger un **ticket WebSocket court** (émis via `GET /ws/ticket?scope=...`) et envoyé par le client dans `x-lila-ws-ticket`.
Ce mécanisme remplace le secret partagé statique côté client (déconseillé).

### Variables d’environnement clés

| Variable | Description |
| --- | --- |
| `JWT_ALGORITHM` | `RS256` (recommandé) ou `HS256` (legacy). Si absent, le backend déduit le mode selon la présence de clés RSA. |
| `JWT_PRIVATE_KEY_PATH` / `JWT_PRIVATE_KEY_PEM` | (RS256) Clé privée PEM pour signer les tokens. Ne jamais exposer au client. |
| `JWT_PUBLIC_KEY_PATH` / `JWT_PUBLIC_KEY_PEM` | (RS256) Clé publique PEM pour vérifier les tokens. Peut être distribuée aux clients. |
| `JWT_SECRET` | (HS256 legacy) Secret partagé pour signer/vérifier. Ne jamais l’embarquer dans un client. |
| `GAME_ENGINE_STATE_REDIS_URL` | Redis utilisé pour persister l’état des parties (requis pour la reprise après crash). |
| `SESSION_STORE_REDIS_URL` | Redis pour les sessions WS/API, notifications et présence (peuvent avoir leurs URL dédiées). |
| `ROOM_PAYLOAD_REDIS_URL` | (Optionnel) Redis pour le cache court des payloads room (sinon utilise `SESSION_STORE_REDIS_URL`). |
| `NOTIFICATION_REDIS_URL`, `PRESENCE_REDIS_URL` | (Optionnel) Redis distincts pour partager les flux de notifications/presence entre plusieurs instances. |
| `WS_TICKET_SECRET` | Secret serveur pour signer les tickets WS courts (ne jamais l’exposer au client). |
| `WS_TICKET_TTL_SECONDS` | Durée de vie des tickets WS en secondes (ex: 60). |
| `WS_SHARED_SECRET` | Legacy : ancien secret partagé côté client pour `/ws` (compat clients anciens uniquement). |
| `DATABASE_URL` | Optionnel : connexion MySQL complète (`mysql://user:pwd@host:3306/db`). Sinon utiliser `DB_HOST`, `DB_USER`, etc. |
| `CORS_ORIGINS` | Liste d’origines autorisées (séparées par des virgules). En production, si vide : CORS est désactivé. |
| `RATE_LIMIT_TTL` / `RATE_LIMIT_COUNT` | Fenêtre (s) et nombre de requêtes maximum pour le throttling global. |
| `LOG_DIR`, `LOG_FILES_ENABLED`, `LOG_LEVEL` | Contrôlent l’écriture des logs Winston (dossier, activation fichiers, niveau). En container : préférer `LOG_FILES_ENABLED=false` pour loguer sur stdout. |
| `CLIENT_UPDATES_DIR` | Dossier servi sur `/updates/client-win/` (ClickOnce/ZIP). Recommandé: un chemin persistant hors du dépôt. |
| `CLIENT_UPDATES_META_PATH` | Chemin du fichier `latest.json` (métadonnées), recommandé hors du dépôt. |
| `CLIENT_UPDATES_UPLOADS_DIR` | Dossier des uploads chunkés temporaires (`init/chunk/complete`), recommandé hors du dépôt. |
| `CLIENT_UPDATES_PUBLIC_URL` | URL publique des updates (ex: `https://api.lilas.hociatec.fr/updates/client-win/`). |
| `TAVERNE_CATEGORIES_ROOT` | Dossier miroir des catégories taverne. En production, le laisser hors du dépôt pour éviter un worktree Git “dirty”. |

## Tests

```bash
npm test          # toutes les suites unitaires
npm run test:cov  # + rapport de couverture
```

Le seuil global reste fixé à 80 % ; ajoutez des tests avant d’augmenter le périmètre du moteur.

## Build & Production

```bash
npm ci
npm run build
npm run migration:run         # exécute les migrations sur la base distante
NODE_ENV=production node dist/main
```

### Script helper

`deploy-prod.sh` (à la racine du dépôt) automatise les étapes suivantes :

1. `git pull --ff-only`
2. `npm ci && npm run build`
3. `npm run migration:run`
4. `sudo npm run service:restart -- lila-backend` (ou `sudo systemctl restart lila-backend.service`)

Personnalisez ce script selon votre stack (pm2, Docker, etc.) en conservant les étapes build+migrations.

## Maintenance (admin)

Le backend expose (optionnellement) des endpoints admin pour déclencher un déploiement **via systemd** (build + migrations + restart).

Variables :

- `ADMIN_MAINTENANCE_ENABLED=true` : active les endpoints.
- `ADMIN_MAINTENANCE_TOKEN=...` : secret requis via header `x-admin-maintenance-token`.
- `ADMIN_MAINTENANCE_REQUIRE_TOKEN=false` : (optionnel) désactive l'exigence du token (le JWT admin reste requis).
- `ADMIN_MAINTENANCE_ALLOWED_IPS=1.2.3.4,5.6.7.8` : (optionnel) allowlist IP.
- `ADMIN_MAINTENANCE_DEPLOY_UNIT=lila-backend-deploy.service` : (optionnel) unit systemd de déploiement.
- `ADMIN_MAINTENANCE_BACKEND_SERVICE=lila-backend.service` : (optionnel) service backend.

Endpoints :

- `POST /api/admin/maintenance/deploy`
- `GET /api/admin/maintenance/deploy/status`
- `GET /api/admin/maintenance/deploy/logs?tail=200`
- `GET /api/admin/maintenance/service/status`

Des templates systemd/sudoers sont fournis dans `backend/tools/systemd/`.

## Notes moteur de jeu

- Le moteur conserve désormais les états des parties dans Redis (`GAME_ENGINE_STATE_REDIS_URL`). Sans cette variable, un message d’avertissement est émis et la persistance retombe en mémoire (à n’utiliser qu’en dev).
- Les jeux prototypes (ex. *Mission Nemesis*) sont désactivés tant que `ENABLE_PROTOTYPE_GAMES=true` n’est pas défini. Ils n’apparaissent plus dans le catalogue tant que leur manifest contient `"enabled": false`.

Pour une vue détaillée de l’architecture (AbstractGameService, BasePresenterService, ActionDispatcher, etc.), consultez `DEVELOPER_GUIDE.md`.

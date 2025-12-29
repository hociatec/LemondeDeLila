# Backend – Le Monde de Lila

Plateforme NestJS qui gère les salons, le moteur de jeux, la messagerie et la présence temps réel.

## Prérequis

- Node.js 20+
- npm 10+
- MySQL 8 (ou MariaDB 10.6+, via `DATABASE_URL`)
- Redis (obligatoire en production pour les états de jeu et les sessions WS)

## Installation locale

```bash
cp .env.example .env          # renseigner JWT_SECRET + URLs Redis
npm ci
npm run migration:run:dev     # crée/maj le schéma MySQL local
npm run start:dev             # API + gateways en mode watch
```

### Mise en place MySQL (dev)

Sur Ubuntu, le user `root` est souvent en `auth_socket` (pas de mot de passe), donc la connexion applicative doit utiliser un user dédié.

```bash
sudo mysql < backend/tools/sql/create-db-user.mysql.sql
```

### Sécurisation WS

Définissez un secret partagé (`WS_SHARED_SECRET`) dans votre `.env` et fournissez la même valeur au client (`config/client.properties` → `network.ws.secret` ou variable `NETWORK_WS_SECRET`). Lorsque ce secret est configuré, les connexions `/ws` non signées sont fermées immédiatement.

### Variables d’environnement clés

| Variable | Description |
| --- | --- |
| `JWT_SECRET` | Clé de signature des JWT. Obligatoire, aucune valeur par défaut en dehors du `.env.example`. |
| `GAME_ENGINE_STATE_REDIS_URL` | Redis utilisé pour persister l’état des parties (requis pour la reprise après crash). |
| `SESSION_STORE_REDIS_URL` | Redis pour les sessions WS/API, notifications et présence (peuvent avoir leurs URL dédiées). |
| `NOTIFICATION_REDIS_URL`, `PRESENCE_REDIS_URL` | (Optionnel) Redis distincts pour partager les flux de notifications/presence entre plusieurs instances. |
| `WS_SHARED_SECRET` | Secret partagé avec le client pour autoriser l'accès aux WebSocket `/ws`. Laisser vide pour désactiver (déconseillé en prod). |
| `DATABASE_URL` | Optionnel : connexion MySQL complète (`mysql://user:pwd@host:3306/db`). Sinon utiliser `DB_HOST`, `DB_USER`, etc. |
| `CORS_ORIGINS` | Liste d’origines autorisées (séparées par des virgules). Laisser vide pour autoriser tout en dev. |
| `RATE_LIMIT_TTL` / `RATE_LIMIT_COUNT` | Fenêtre (s) et nombre de requêtes maximum pour le throttling global. |
| `LOG_DIR`, `LOG_FILES_ENABLED`, `LOG_LEVEL` | Contrôlent l’écriture des logs Winston (dossier, activation fichiers, niveau). |

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
4. `sudo systemctl restart lila-backend.service` (adapter le nom du service)

Personnalisez ce script selon votre stack (pm2, Docker, etc.) en conservant les étapes build+migrations.

## Notes moteur de jeu

- Le moteur conserve désormais les états des parties dans Redis (`GAME_ENGINE_STATE_REDIS_URL`). Sans cette variable, un message d’avertissement est émis et la persistance retombe en mémoire (à n’utiliser qu’en dev).
- Les jeux prototypes (ex. *Mission Nemesis*) sont désactivés tant que `ENABLE_PROTOTYPE_GAMES=true` n’est pas défini. Ils n’apparaissent plus dans le catalogue tant que leur manifest contient `"enabled": false`.

Pour une vue détaillée de l’architecture (AbstractGameService, BasePresenterService, ActionDispatcher, etc.), consultez `DEVELOPER_GUIDE.md`.

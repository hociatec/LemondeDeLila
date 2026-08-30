# Matrice de résilience Room/Game

Cette matrice relie chaque garantie opérationnelle à un contrôle exécutable.

| Risque | Garantie | Contrôle |
|---|---|---|
| doublon externe/reconnexion | replay borné par acteur, scope et `requestId`; collision de type rejetée | `realtime-api-handler.service.spec.ts` |
| doublon de commande de jeu | reçu `commandId` dans l'état versionné | `game-command-executor.service.spec.ts` |
| version locale obsolète | CAS rejette le commit et l'état persistant est reprojeté | `game-engine.service.spec.ts`, `game-ws-realtime-state.service.spec.ts` |
| session remplacée/nouveau run | snapshot de l'ancien `roomRunId` supprimé | `game-ws-realtime-state.service.spec.ts` |
| timer livré après restart ou deux fois | tâche BullMQ durable, signature stable, génération contrôlée et CAS idempotent | `game-realtime-automation.service.spec.ts`, `tools/redis-bullmq-integration.cjs` |
| contention dans une room | queue locale + lock distribué + CAS | `game-room-command-queue.service.spec.ts`, `mysql-game-room-lock.service.spec.ts`, `tools/mysql-migrations-integration.cjs`, `tools/two-instance-real-e2e.cjs` |
| Redis indisponible | cache/pubsub optionnel désactivé sans faux succès métier | `room-payload-cache.service.spec.ts`, `redis-pubsub.transport.spec.ts` |
| DB/transaction indisponible | échec fermé et rollback état/événements | `mysql-game-room-lock.service.spec.ts`, `tools/mysql-migrations-integration.cjs` |
| disque plein/quota | réserve et quota vérifiés avant publication atomique | `storage-capacity.spec.ts`, specs update/sounds/client-updates |
| fuite de sockets/timers/listeners | suppression exacte des listeners et purge runtime au shutdown | `room-runtime-cleanup.spec.ts` |
| dérive opérationnelle | conflits CAS, attente/échec de lock, retard BullMQ, reconnexions, erreurs et backpressure WS mesurés | `operability:audit`, `game-engine-metrics.service.spec.ts`, `ws-api-hub.service.spec.ts` |
| charge multi-room | latences de phases, CPU/RSS client, métriques MySQL et Redis | `npm run test:load:room:real` |

Le test réel de charge requiert un backend, MySQL et, si configuré, Redis. Les
seuils de CI peuvent être fournis par l'environnement afin de tenir compte de
la machine exécutante; le rapport conserve les valeurs brutes pour comparaison.

# Certification de production du backend

Cette certification porte sur le dépôt complet et sa chaîne de livraison au
12 septembre 2026. Le backend est livré comme artefact Node pour un service
systemd ; Docker ne fait pas partie du contrat de déploiement de ce dépôt.

| Domaine              | Contrat vérifié dans le dépôt                                                                                                                 |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| dépendances          | `package-lock.json`, installation CI par `npm ci --ignore-scripts`, audit de gouvernance et versions Node 24                                  |
| intégration continue | actions épinglées par SHA, `quality:check`, graphe sans cycle, séparation runtime/compiler et audits de frontières                            |
| artefact             | build TypeScript, dépendances de production seules, manifeste avec SHA Git et checksum du lockfile, archive reproductible et checksum SHA-256 |
| configuration        | validation centralisée au démarrage, secrets de production sans valeur de repli, limites HTTP/WS et Redis séparés                             |
| sécurité de session  | quotas HTTP/WS distribués et rotation à usage unique des refresh tokens Redis                                                                 |
| santé                | `/health/live` pour le processus et `/health/ready` pour MySQL, Redis et BullMQ avec délais bornés                                            |
| arrêt                | SIGTERM/SIGINT, refus des nouvelles entrées, arrêt des sources, double drain, fermeture WS/queues/Redis/Nest                                  |
| observabilité        | corrélation HTTP/WS/jobs/pubsub, logs nettoyés, métriques bornées, télémétrie des conflits CAS, verrous et dead letters                       |
| validation réelle    | scripts MySQL, Redis/BullMQ, deux instances, campagnes de jeu, reprise après sinistre et charge Room                                          |

Le pipeline de contenu est indépendant de l'artefact applicatif. Ses releases
sont immuables, adressées par checksum, activées atomiquement et conservées tant
qu'un snapshot actif peut les référencer. Les sessions, événements et snapshots
Game sont commis dans une transaction SQL. BullMQ transporte seulement le réveil
rejouable ; son identité contient run, restore, versions et plan. Les commandes
et consumers sensibles disposent d'identifiants ou de reçus idempotents.

Les publications Redis et projections WebSocket sont reconstructibles depuis
SQL. Les notifications durables utilisent leur inbox SQL. Elles ne nécessitent
donc pas d'outbox transactionnelle pour le contrat actuel. Toute future sortie
inter-domaine non reconstructible devra ajouter une intention durable, une clé
d'idempotence et un test de panne avant activation.

Les commandes de validation de release sont :

```text
npm ci --ignore-scripts
npm run quality:check
npm run runtime:separation:audit
npm run typecheck:prod
npm run build
npm run verify:dist
npm run test:integration:real
```

## Limite de la certification

Le dépôt certifie la présence, le caractère bloquant et l'exécution locale des
contrats automatisables. Il ne peut pas certifier à lui seul qu'un workflow
distant a réellement été exécuté, qu'un artefact précis a été déployé, ni qu'une
restauration de sauvegarde a réussi sur l'infrastructure de production. Ces
preuves externes doivent être attachées à chaque release : résultat CI, identité
et checksum de l'artefact, journal de déploiement, contrôles MySQL/Redis/BullMQ
et compte rendu daté du dernier exercice de restauration. Sans ces éléments, la
formulation correcte reste « prêt et vérifié dans le dépôt », jamais « production
réelle certifiée ».

Les résultats locaux datés sont consignés dans
[`release-evidence-2026-09-13.md`](../quality/release-evidence-2026-09-13.md).

# Concurrence, état et reprise

## Responsabilités

- La queue locale conserve l'ordre des commandes d'une room dans un processus et réduit le travail concurrent local. Elle ne garantit rien entre instances.
- `GameRoomLock` sérialise le travail d'une room entre instances. En production MySQL, l'adapter utilise `GET_LOCK` sur une connexion dédiée, avec timeout et échec fermé.
- Le CAS transactionnel du `GameStateStore` est l'unique garantie de correction. Un verrou perdu ne permet jamais d'écraser une version plus récente.
- `commandId` rend une commande de jeu rejouée idempotente. Le journal de reçus appartient à l'état versionné.

Les retries ne concernent que les lectures idempotentes et les conflits explicitement reconstruits depuis la dernière version. Une écriture dont le résultat est inconnu n'est jamais rejouée sans clé d'idempotence.

## Source de vérité

| Donnée | Source de vérité | Cache/local | Reconstruction |
|---|---|---|---|
| état de partie | MySQL `game_sessions` + version CAS | projections WS | relecture DB; conversion incompatible uniquement hors ligne |
| sessions auth | Redis configuré en production | aucune | reconnexion obligatoire si Redis est perdu |
| room et participants | MySQL | payload Redis/local | invalidation puis relecture DB |
| présence/sockets | connexions actives de l'instance | Maps locales | reconnexion et resynchronisation |
| timers de règle | scheduler persisté dans l'état de partie | timer de réveil local | recalcul à partir de l'échéance persistée |
| bots, debounce et grâce de départ | local, non durable | timers locaux | annulés au shutdown; état DB vérifié à l'exécution |

Les notifications métier durables sont écrites en DB avant diffusion. Redis Pub/Sub et les broadcasts sont des accélérateurs best-effort; un client reconnecté recharge son inbox ou son état de room.

## États JSON

Chaque état de jeu déclare les versions exactes du moteur, du contenu et des
règles attendues. Une lecture incompatible échoue sans transformation runtime;
la conversion éventuelle est une opération hors ligne préalable au déploiement.
La taille de l'état et de la timeline est bornée par `GameSnapshotPolicy`; les
snapshots et événements sont séquencés et le replay est déterministe. La
timeline est physiquement séparée entre session courante, événements et
snapshots, tout en restant atomique dans la transaction du
`GameSessionTypeormStore`.

## Scénarios obligatoires

- deux queues d'instances différentes sur une même room;
- doublon de `commandId`, version obsolète et conflit CAS;
- rejet d'un état d'ancienne version et replay identique d'un état courant;
- reconnexion après perte d'un broadcast;
- arrêt pendant un timer: aucun callback local après destruction, reprise depuis l'état durable lorsqu'il s'agit d'une règle.

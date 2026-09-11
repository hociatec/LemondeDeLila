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
| décisions bots et grâce de départ | jobs BullMQ identifiés par room/run | planification locale de réveil | relecture du run actif et rejet des jobs obsolètes |
| debounce de diffusion | local, non durable | timers locaux | annulation au shutdown et resynchronisation complète à la reconnexion |

## Commandes, effets et projections

L'exécuteur clone profondément l'état d'entrée et valide chaque action avant
son application sur la copie. Un batch travaille sur le résultat de l'action
précédente ; si une action ou un effet échoue, aucun résultat partiel n'est
committé. Les règles exécutent des effets déterministes en mémoire et accumulent
leurs événements. Les I/O de stockage appartiennent à l'orchestration et la
diffusion suit le commit CAS. Une erreur de diffusion après commit ne doit
pas provoquer le rejeu de toute la mutation.

Les effets suivent l'ordre de leur file ; les règles automatiques utilisent
leurs priorités et l'ordre de déclaration pour les égalités. Le runtime borne
la stabilisation et le nombre d'effets ; un débordement rejette la commande
avec sa trace. Un effet métier n'est pas réessayé séparément : il faut corriger
la commande ou la règle. Les retries d'infrastructure ne réexécutent pas les
règles sans reconstruction et identité de commande appropriées.

Le journal embarqué conserve les 256 derniers reçus de commandes. Il ne
constitue donc pas une déduplication éternelle. Les conflits de version sont
remontés ; le client recharge une vue complète et soumet une nouvelle décision
sur cette version. Les messages transportent `roomId`, `runId` et `version`.
La projection est construite depuis un seul état et l'identité du viewer :
le système et les kits choisissent explicitement les champs publics, les
mains et événements privés sont filtrés génériquement. Les exports d'état
interne servent à la persistance et au test, sans route de snapshot moteur
accessible au joueur ordinaire. Le backend permet de détecter les messages
hors ordre ; garantir leur rejet dans tous les clients reste le point 603.

L'état initial appartient à sa partie : joueurs, métadonnées, tour et
collections moteur sont nouvellement créés ou clonés profondément. Le
contenu et les définitions sont partagés après compilation et gel ; aucune
collection mutable de session ne doit être placée dans ces définitions.
Les snapshots de session utilisent des tableaux et objets JSON, pas Map/Set,
fonctions, accesseurs, cycles ou nombres non finis. Map/Set de contenu statique
ne sont pas des états à persister. Les tris de classement appliquent les
critères dans l'ordre déclaré ; une égalité conserve le même rang et utilise
l'identifiant numérique du joueur pour stabiliser l'ordre d'affichage.

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

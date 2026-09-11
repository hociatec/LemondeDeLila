# Revue des frontières runtime, room et WebSocket

État historique de ce lot. La [troisième passe](patterns-caches-jobs-review-2026-09-08.md)
renforce ensuite le contrôle des cycles et clôture 170–171 et 192–193.

Cette passe reprend les 100 premières exigences restantes, de 14 à 258
(numérotation originale discontinue). Douze exigences sont clôturées ; les
88 autres restent dans le backlog. Une extraction partielle ne vaut pas clôture.

## Compilation et ownership

- 29 : `assertStaticEffectReferences` parcourt le contenu, y compris les
  catalogues non installés dans une pioche. Les instructions sont contrôlées
  par le validateur commun ; les résolveurs hérités de Object.prototype sont
  refusés. Les références produites dynamiquement ne deviennent pas statiques.
- 151 : les identifiants de composants suivent la grammaire
  `[a-zA-Z0-9][a-zA-Z0-9._:-]*`, sans conversion silencieuse ; les noms réservés
  de prototype sont refusés. Les 38 définitions passent la compilation.
- 154 : les références de composants existantes sont complétées par les
  pistes et ensembles de pions d'initialisation ainsi que les inventaires des
  vues de collection. Le point 30 reste ouvert pour l'ensemble des ressources,
  cartes et cases, notamment les références construites par les règles.
- 119 : la table de contrôle d'ownership est exhaustive sur l'union des types
  de composants. Scores et tours supplémentaires/sautés sont contrôlés même
  sans composant optionnel. L'audit AST s'exécute sur les 38 jeux. Il ne prouve
  pas l'absence de données équivalentes stockées sous des noms différents.

## Frontière Room/Vault

Les points 182 et 183 sont clôturés par `VaultRoomPort`, propriété du consommateur,
et une projection dédiée `VaultRoomSnapshotSource` de version 1. Le module Vault
n'importe plus Room. `AppRoomVaultPortsModule` associe les contrats à la racine,
avec vérification TypeScript et test du branchement Nest.

Room copie les identités et listes nécessaires, sérialise startedAt en ISO et
n'expose ni manifeste de lobby ni actions autorisées. Le writer utilise ce DTO
typé. Le format persistant existant et ses procédures de restauration restent en
place ; les tests de restauration avec compensation passent. Il n'y a pas de
migration des snapshots stockés dans ce lot.

Le point 221, audit de Room, est également clos. Room combine gestion des salles,
participations, bots, présentation de lobby et appels à presence, notifications,
stats, sons, catalogue et update. Son wiring inscrit encore l'entité User.
L'ownership des participants et bots reste dans Room ; les workflows impliquant
plusieurs domaines restent à extraire vers une orchestration applicative.
La liaison Vault déplacée à la racine réduit une dépendance, mais ne clôture
pas 170–174, 191–193, 198–217, 222 ou 227. En particulier, l'absence de SCC
transitif à l'échelle de l'application n'est pas attestée par ce seul retrait.

## Audit des handlers WebSocket (228)

| Élément | Constat et décision |
| --- | --- |
| GameWsStateMessagesPresenter | Lecture des événements, choix des libellés et copies de projection uniquement. Aucun commit ni décision de partie : 229 est satisfait après revue. |
| GameRealtimeAutomationService | Planification, exécution, queue, bots, métriques et notification après commit ; séparation supplémentaire encore à étudier, 230 reste ouvert. |
| RealtimeApiHandlerService | Décodage délégué au codec commun ; politiques de session, dispatch et replay restent coordonnés dans le handler, 231 reste ouvert. |
| GameWsRealtimeStateService | Résolution, versions, roster, isolation des runs et commits déplacés dans GameRoomStateLifecycle, indépendant de Nest et du transport. L'adaptateur présente et diffuse ; 232 est clos. |
| RoomGatewayStateService | Rafraîchissement, promotion de participants, cache/projection et envoi encore mêlés ; 233 et les exigences globales 235–237 restent ouverts. |
| RoomGatewayCommandService | Décodage commun, mais routage, ACK immédiat, trace et pong restent ensemble ; 234 et 239 restent ouverts. |

La lecture d'une version pour la présentation ne modifie plus l'état source.
Les projections d'ajout/retrait de bots retournent de nouvelles listes et une
nouvelle enveloppe. Des tests utilisent des entrées gelées. Les points globaux
246–247 restent ouverts jusqu'à revue de tous les chemins de présentation.

## Compatibilité du protocole et temps

Le point 241 est satisfait par un contrat d'entrée explicite de version 1,
partagé entre API et Room. Les clients historiques peuvent omettre
protocolVersion ; une version explicite autre que 1 est refusée. Les types
string, Buffer et ArrayBuffer passent par le même décodage JSON borné en octets.
Les identifiants vides, propriétés d'enveloppe inconnues et versions invalides
sont refusés. Les clients envoyant auparavant des propriétés supplémentaires
à Room devront respecter ce contrat. Les enveloppes sortantes et ACK ne sont
pas unifiés : 240 reste ouvert. clientVersion est une métadonnée de diagnostic,
pas une sélection de comportement.

Le point 248 est clos : les producteurs de generatedAt utilisent
`presentationTimestamp`, date ISO UTC de génération de projection. Cette
fonction n'est pas une horloge de décision métier. L'injection d'horloge pour
les autres caches, invitations, bannissements et sessions reste à poursuivre.

## Vérification

Suite complète : 196 suites et 711 tests réussis avant le dernier cas de
régression du parcours Map/Set, puis suites ciblées de compilation relancées.
Typecheck, lint, build, chargement de l'AppModule et quality:check passent.
Les budgets et baselines des audits ne sont pas augmentés.

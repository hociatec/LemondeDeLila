# Lot : API internes, verrous et retries — 11 septembre 2026

Ce lot clôture les points **158, 168 et 183** du snapshot courant de
`backend/corriger.txt`. Le backlog passe de **52 à 49 points ouverts**.

| Point | Correction et preuve |
| --- | --- |
| 158 | Les API joueur ne proposent pas d'export d'état interne, restauration, snapshot ou replay. Le registre des routes de jeu est testé contre une liste exacte de neuf routes ; les noms d'API internes sont explicitement absents. Les lectures joueur passent par `present`, dont la projection publique a été renforcée dans les passes précédentes. Les diagnostics administrateur restent sous les contrôles admin, vérifiés par l'audit de sécurité. |
| 168 | Les maintenances incompatibles utilisent une même clé Redis, indépendante du nom d'opération. Redis est requis en production, même si le drapeau optionnel vaut faux. Le fichier local ne sert qu'à l'exclusion locale ; un propriétaire vivant n'est plus évincé sur le seul dépassement d'une durée. La publication du manifeste WX acquiert désormais son propre bail Redis commun et vérifie sa possession avant écriture. La finalisation des uploads possédait déjà un bail par upload ; sa libération couvre maintenant aussi les échecs d'acquisition du verrou local. |
| 183 | Les connexions Redis applicatives désactivent `autoResendUnfulfilledCommands` : une commande dont la réponse est perdue n'est pas renvoyée implicitement, car elle peut avoir déjà modifié Redis. La factory impose cette règle même si un appelant tente de la remplacer. Les connexions directes de session et Pub/Sub appliquent aussi cette règle. Les retries de connexion MySQL concernent le démarrage ; aucun mécanisme de rejeu de transactions métier n'a été trouvé dans le périmètre audité. Les retries BullMQ restent explicites et associés à des tâches identifiées, dont l'automatisation rejette les livraisons obsolètes. |

## Fichiers et comportement

Les changements concernent la factory Redis, le stockage de sessions, le
transport Pub/Sub, le verrou de maintenance, les services de publication et
de finalisation WX et leurs tests. L'exécution des maintenances utilise un
`await` avec libération dans `finally`, y compris pour les callbacks synchrones.

La publication WX reste atomique au niveau du fichier manifeste. Les verrous
de fichier de publication/finalisation ne sont pas présentés comme des verrous
distribués. Les fichiers temporaires d'écriture atomique et les sondes disque
ne constituent pas des mécanismes d'exclusion entre instances.

La factory Redis conserve la reconnexion réseau : seule la réémission automatique
des commandes restées sans réponse est désactivée. Ce réglage ne garantit pas
une livraison exactement une fois. L'idempotence métier, l'outbox/inbox et la
fiabilité des notifications restent suivies aux points 159, 162 et 164.

## Validation

- Lot ciblé : **11 suites, 60 tests réussis**.
- Après simplification du verrou : **10 tests réussis** dans sa suite dédiée.
- Tests de publication : refus de concurrence, perte du bail avant manifeste,
  libération après succès ; test d'upload : libération après conflit local.
- Tests de maintenance : opérations distinctes sur deux chemins locaux,
  exigence Redis en production, propriétaire local vivant après expiration.
- TypeScript, lint ciblé, audits de structure, architecture et sécurité.
- Build : **1 685 fichiers compilés**, module compilé chargé avec succès.
- Gouvernance du backlog : **49 points ouverts** ; audit de dette backend réussi.

Les tests de concurrence utilisent un faux service de baux partagé. Aucun
test contre Redis/MySQL réels ni relance de toute la suite backend dans cette
passe. Aucun déploiement ni migration de données.

Au déploiement, laisser terminer les maintenances en cours avant de remplacer
les anciennes instances : la clé Redis de maintenance devient commune.
La vérification d'un bail avant une écriture de fichier n'est pas un mécanisme
de fencing atomique entre Redis et le filesystem.

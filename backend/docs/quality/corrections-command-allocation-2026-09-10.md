# Correction du point 642 — allocations de commande

Le chemin d’acceptation d’une commande ne clone plus l’action avant de la
passer à `appendPendingGameEvent`. Cette frontière clone déjà l’événement de
façon défensive ; le clone interne était donc redondant et doublait
l’allocation de l’action à chaque commande. L’événement reste isolé avant
l’exécution de la règle, ce qui est vérifié par le test dédié.

La copie complète de l’état d’entrée reste volontaire : elle protège la
transaction contre les mutations d’une règle qui échoue. Cette correction
supprime uniquement la copie redondante, sans affaiblir cette garantie.

Validation : suite `game-command-executor.service.spec.ts`, typecheck et
`npm run backlog:check`.

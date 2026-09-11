# Commandes des tables — 9 septembre 2026

Point 234 clôturé : 259 suites / 1 129 tests hors campagne longue, typage,
lint, build/AppModule, quality:check, verify:dist et contrôle du diff réussis.

`RoomGatewayCommandService` coordonne quota, corrélation, accusé de réception
et transmission de la commande. Le décodage borné de l'enveloppe et la
normalisation de l'intention appartiennent à `room-intent-decoder.ts`.
`room-command-router.ts` route les commandes vers les handlers du contexte
transport. Le dispatcher appelle directement ces fonctions ; les anciennes
méthodes de simple délégation ont été supprimées du service.

Le contrat de contexte est explicite dans `room-command-context.ts`.
Les commandes admises, les codes d'erreur, la priorité des traces et l'ordre
quota/ACK/exécution sont conservés. Les tests ciblés du pipeline et du gateway
passent : 3 suites / 15 tests.

Validation finale : logs/corrections-replay-command-{all-tests,typecheck,lint,build,quality-final}.log.

Journaux ciblés : `logs/corrections-room-command-{targeted,typecheck}.log`.

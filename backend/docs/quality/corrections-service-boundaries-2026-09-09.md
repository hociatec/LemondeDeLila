# Responsabilités des services — 9 septembre 2026

Points 230 et 231 clôturés et retirés après validation. Le fichier conserve 253 points ouverts.

## Point 230 — automatisation des parties

`GameAutomationPlannerService` sélectionne le prochain plan automatique ou bot,
avec sa signature et son échéance. `GameRealtimeAutomationService` coordonne
la livraison : enregistrement des tâches, refus des tâches obsolètes, file de
commandes, exécution, sauvegarde conditionnelle, publication et replanification.
Les deux services sont câblés explicitement dans les providers du module jeu.

La séparation conserve les règles de priorité entre actions automatiques,
choix en attente et tours de bots. Les tests d'automatisation et de dispatch
passent : 2 suites et 21 tests.

## Point 231 — messages temps réel

`RealtimeApiTransportService` possède le décodage borné des messages, les
trames d'erreur et l'envoi WebSocket. `RealtimeSessionPersistenceService`
possède la sauvegarde et la suppression des identités de session. Le service
de connexion attend cette suppression pendant le nettoyage.

`RealtimeApiHandlerService` coordonne le traitement d'une requête : quota,
identifiant de corrélation, replay, version du client et appel du handler.
Il délègue désormais le transport et ne persiste plus les sessions.

Les tests de handler et de connexion conservent leurs assertions sur le
traitement et le nettoyage. Deux tests supplémentaires vérifient les seuls
champs d'identité persistés et l'attente effective de la suppression.

## Vérification

254 suites / 1107 tests réussis hors campagne longue ; typage, lint, compilation,
chargement AppModule, quality:check et verify:dist réussis. Les deux tests
du contrat d'horloge passent aussi après déplacement du fichier. Les journaux de validation d'ensemble sont
`logs/corrections-boundaries-{tests,typecheck-final,lint,quality-final,build}.log`.
La campagne de replay des jeux est suivie séparément ; aucune intégration
Redis réelle ni mise en production n'est attestée par cette extraction.

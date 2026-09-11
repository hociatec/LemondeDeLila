# Audit du point 682 — responsabilités des services

L’audit ciblé des services d’orchestration et de présentation ne trouve pas
de service métier cumulant sept responsabilités indépendantes.

`RoomGatewayDispatcherService` possède plusieurs méthodes, mais une seule
responsabilité : raccorder les événements WebSocket aux handlers spécialisés.
`RoomGatewayContextService` compose les contextes nécessaires, tandis que
`RoomStateService`, `RoomMembershipService` et `RoomPayloadService` portent
des capacités distinctes. Les traversées pass-through détectées dans la
chaîne d’appel ont été supprimées au profit de `RoomPayloadService` direct.

Les contrôles `architecture:test`, `structure:check`, `service-depth:audit`
et `backlog:governance` valident cette répartition. Le point 682 est clôturé
avec cette preuve.

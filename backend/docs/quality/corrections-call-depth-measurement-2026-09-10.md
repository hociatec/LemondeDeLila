# Mesure des points 680–681 — profondeur d’appel

`tools/service-call-depth-check.cjs` construit le graphe des appels entre
services à partir des dépendances injectées et des appels
`this.dependency.method()`. Il détecte les cycles et impose une limite de
profondeur configurée.

Mesure actuelle : 710 classes analysées, profondeur maximale 9, avec une
limite de 9 contrôlée par l’audit. La chaîne maximale observée est :

`RoomGateway -> RoomGatewayDispatcherService -> RoomGatewayContextService ->
RoomGatewayPresenceService -> RoomMembershipFacadeService ->
RoomMembershipService -> RoomLeaveService -> RoomEmptyCleanupService ->
RoomVaultSnapshotRepository`.

La présence et la façade de membership ne traversent plus `RoomStateService`
pour les opérations de payload : elles dépendent directement de
`RoomPayloadService`. La profondeur maximale reste à 9, mais chaque couche
restante correspond à un niveau distinct (transport, dispatch, contexte,
présence, orchestration membership, cas d’usage, nettoyage et persistance).
Le test de contrat valide aussi une chaîne de trois services et un cycle.
Les points 680–681 sont donc couverts par une limite mesurée et par la
suppression des traversées pass-through identifiées.

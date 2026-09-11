# Participants et suppression des snapshots

Le module `room` possède les participations aux salles : la table
`room_participants`, son entité TypeORM et les opérations d'entrée/sortie.
`presence` consomme une projection de ces données pour afficher les salles
actives des utilisateurs ; il ne possède pas les participations.

`ActiveRoomParticipantsReader`, exporté par l'API publique de `room`, fournit
les identifiants des utilisateurs et une projection des salles. L'adaptateur
filtre les participations dont `leftAt` est nul, conserve l'ordre décroissant
de `joinedAt` et la limite historique de 10 lignes par utilisateur, plafonnée
à 1 000. Les champs privés des entités ne font pas partie de la projection.
Cette lecture bornée ne promet pas une liste exhaustive au-delà du plafond.

`vault` possède les snapshots. `OwnedSnapshotDeleter` supprime un snapshot
en imposant simultanément son identifiant et celui de son propriétaire.
`room` utilise son propre port applicatif sans enregistrer l'entité de `vault`
ni accéder à son repository TypeORM.

`AppPresenceReadersModule` et `AppVaultPortsModule` relient les contrats par
`useExisting` dans la composition de l'application. Une composition alternative
doit fournir ces ports ou importer les modules de composition correspondants.
Les tests vérifient leur visibilité dans des modules Nest indépendants.
Le contrat d'architecture interdit les dépendances `presence → room` et
`room → vault`, y compris dans le câblage des modules.

Les accès historiques de `bot` ont ensuite été remplacés par `RoomBotsRepository`
et `AppBotPortsModule` ; voir `module-boundary-review.md`. L'orchestration globale
du cycle bot/vault/room/presence reste au backlog.

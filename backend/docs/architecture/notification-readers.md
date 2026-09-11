# Lecteurs utilisés par notification

`messaging` possède `UnreadPrivateMessagesReader` et exporte son jeton depuis
son API publique. Son repository TypeORM reste privé au module.
`social` possède `AcceptedFriendsReader` et son adaptateur TypeORM ; ce lecteur
retourne les identifiants des amis acceptés dans les deux sens de la relation,
avec la limite historique de 500 relations et un ordre déterministe.

`AppNotificationReadersModule`, importé par `AppCapabilitiesModule`, relie ces
lecteurs aux deux ports définis par `notification` au moyen de `useExisting`.
Ce module global expose les ports aux consommateurs Nest sans recréer les
repositories. Toute composition alternative utilisant `NotificationModule`
doit fournir ces deux ports, ou importer cette composition d'application.

`messaging` et `social` peuvent importer l'API publique de `notification` pour
émettre des notifications. `notification` ne dépend plus de ces deux modules,
de leurs entités ni de leurs adaptateurs. Le contrat d'architecture interdit
ces dépendances, y compris dans les fichiers de composition des modules.

Le test `app-notification-readers.module.spec.ts` vérifie la visibilité des
ports dans un module Nest indépendant et l'identité des lecteurs injectés.
Le test du lecteur social vérifie les filtres, les deux directions et la borne.
Le test de l'auditeur vérifie que la composition ne contourne pas l'interdiction.

Cette correction ne supprime pas les autres cycles entre domaines ni les
relations ORM vers `User`, qui restent inscrits au backlog.

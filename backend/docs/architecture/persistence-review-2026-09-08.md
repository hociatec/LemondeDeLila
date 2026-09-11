# Revue de persistence et d'histoire des migrations

Propriétaire : équipe backend. Revue : 2026-09-08.

Le registre `src/app/database/typeorm-entities.ts` contient les 26 entités transmises à Nest
et au CLI TypeORM. Le test `typeorm-entities.spec.ts` compare toutes les classes
des fichiers `.entity.ts` au registre et refuse les doublons ou omissions. Les
`forFeature` déclarent les repositories injectables locaux ; ils ne constituent
pas un second mécanisme de découverte du DataSource. Le double enregistrement
dans plusieurs modules et les entités étrangères restent aux points 200/444.

Le scanner `persistence:audit` interdit QueryBuilder hors adapters TypeORM et
signale les chargements de collections non bornés ainsi que les boucles avec
accès asynchrones en repository. Les transactions de session, room, stats et
rôles restent derrière leurs ports/adapters, inventoriées dans
[transaction-boundaries](transaction-boundaries.md). Vault utilise une compensation.
La revue n'atteste pas de l'absence de toute transaction transversale implicite.

La revue N+1 distingue jointures et appels par élément : les messages tchat
chargent user dans leur requête ; les projections de participation Room,
d'amitiés Social et de messages non lus Messaging sont des readers explicites.
La notification utilise ces contrats injectés au composition root, sans accéder
aux repositories étrangers. Un `save` suivi d'une relecture de message individuel
n'est pas un N+1 de collection. Il faut encore mesurer les plans SQL en production ;
les audits statiques ne remplacent pas EXPLAIN ni une campagne de charge.

Relations eager repérées : ChatMessage.user, PrivateMessage.sender/recipient,
Room.owner, RoomParticipant.user, SocialProfile.user,
SocialRelationship.requester/addressee, GameMatch.winner et GameMatchPlayer.user.
NotificationInboxItem.user et GameMatchPlayer.match sont explicitement non eager.
La revue 320 est effectuée ; les chargements d'agrégats excessifs et les liens ORM
entre domaines restent aux points 198–217 et 321. On ne les déclare pas éliminés.

## Migrations

Les 39 migrations numérotées sont autonomes vis-à-vis des modèles métier actuels :
imports TypeORM et bibliothèques standard seulement, contrats historiques locaux.
`migration-history.spec.ts` vérifie ces imports et les empreintes SHA-256 de
`tools/migration-history.json` (fins de ligne normalisées). Toute migration ajoutée
doit avoir une nouvelle entrée ; les empreintes historiques ne doivent pas être
régénérées pour faire passer une modification. Le build/typecheck vérifie qu'elles
restent compilables sans importer un service applicatif courant.

Exceptions encore ouvertes : JsonDataToDb et ImportLegacySettingsJson lisent des
fichiers externes mutables ; certaines migrations utilisent CURRENT_TIMESTAMP ou
des valeurs temporelles d'exécution. Elles restent suivies par 431/433/440. Leur
code historique est conservé ; le présent lot n'exécute aucune migration.

Une méthode down présente ne garantit pas un retour des données :

| Famille | Limite de réversibilité |
| --- | --- |
| InitSchema et créations de tables | down détruit les données des tables supprimées |
| JsonDataToDb / ImportLegacySettingsJson | les fichiers externes et anciennes valeurs importées ne sont pas reconstruits |
| PurgePetitChevaux / PurgeLoupGarou | purge définitive des salles, assignations et statistiques ; down sans restauration |
| modifications de colonnes texte / RemoveUnusedEmailVerification | rétrécissement ou recréation ne restitue pas les valeurs tronquées/supprimées |
| NormalizeUserIdentityCollation | la casse/normalisation historique n'est pas reconstruite automatiquement |
| SplitGameSessionTimeline | la recomposition dépend des données présentes ; tester une fixture avant retour |
| CanonicalizeSocialRelationshipPairs | refuse les doublons avant activation de la contrainte ; résolution de données préalable |
| EnforceSingleActiveGameMatch | down enlève la contrainte, mais ne rouvre pas les matchs orphelins clôturés par up |

Un rollback de données nécessite la sauvegarde antérieure et le runbook de
restauration ; ne pas assimiler migration:revert à une restauration complète.
Les batches et durées de locks SQL restent à vérifier (434/435). Les tests locaux
de ce lot n'ont aucune valeur de validation d'une migration sur MySQL réel.

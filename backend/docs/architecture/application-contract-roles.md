# Rôles des contrats applicatifs

Les imports ciblent le fichier propriétaire, sans fichier de réexport conservé
dans `application/contracts`. Le contrôle `application-contract-placement-audit.cjs`
couvre les modules, le moteur et la plateforme.

| Dossier | Rôle |
| --- | --- |
| `ports` | Interface d'une capacité requise ou fournie, avec son jeton d'injection ; aucun type TypeORM. |
| `models` | Structure de données utilisée par les règles et services applicatifs. |
| `read-models` | Projection en lecture, adaptée aux champs effectivement consommés. |
| `commands` | Intention de mutation et ses paramètres. |
| `queries` | Paramètres d'une demande de lecture. |
| `events` | Fait métier et son contrat de publication. |
| `contracts` | Échange transversal explicite et versionné, par exemple une source de snapshot entre Room et Vault. |

`Record` désigne une valeur de données sans identité comportementale ni méthode
de persistance. Son nom ne garantit pas qu'elle soit une ligne SQL : un mapper
établit cette correspondance. `Model` désigne une structure applicative ; elle
peut composer plusieurs records ou porter l'état d'un calcul. `Entity` est réservé
à une entité persistée ou à une entité de domaine dotée d'une identité et
d'invariants. Les états sérialisés du moteur s'appellent `GameState`, `PlayerState`
et `TurnState` ; ils n'ont plus d'alias avec le suffixe `Entity`.

`public-api.ts` expose les capacités métier et leurs données. Les modules Nest
et les jetons nécessaires uniquement au raccordement d'adaptateurs sont exportés
par `composition-api.ts`. Les consumers applicatifs n'importent pas cette entrée.
La plateforme peut exposer ses adaptateurs techniques par son API publique : elle
possède précisément ces mécanismes techniques, contrairement aux domaines métier.

Room lit les ambiances via `TableAmbiencesReader`. Notification lit les
identifiants du personnel via `StaffUsersReader`, sans accès aux mutations User,
aux mots de passe ni aux préférences. Les repositories complets de Messaging et
Social ne font plus partie de leur API publique.

Les relations inverses Room restent nécessaires aux chargements explicites du
lobby. Les enfants référencent la projection `RoomPersistenceRef` et la cible ORM
nommée `Room`, sans importer la classe parent ; le test de métadonnées vérifie
la résolution des clés étrangères et la suppression en cascade.

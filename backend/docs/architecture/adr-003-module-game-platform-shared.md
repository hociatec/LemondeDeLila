# ADR-003 — Frontières modules, game, platform et shared

Statut : accepté.

Le backend adopte quatre frontières physiques sous `src` :

- `modules` pour les capacités métier et applicatives autonomes ;
- `game` pour le moteur, son SDK, sa composition et les jeux ;
- `platform` pour les adapters techniques transversaux ;
- `shared` pour les primitives pures indépendantes des technologies du projet.

Les anciens composants métier placés directement à la racine sont déplacés
sous `modules`. `common` disparaît : auth, Redis, WebSocket, session,
observabilité et validation rejoignent `platform`, tandis que les interfaces
et utilitaires génériques rejoignent `shared`. La configuration, la base de
données, les migrations et le transport realtime rejoignent également
`platform`.

La direction des dépendances est la suivante : `shared` ne dépend d'aucune
autre frontière ; `platform` dépend seulement de `shared` ; `modules` et
`game` peuvent dépendre de `platform` et `shared`. Les relations entre modules,
ainsi qu'entre modules et `game`, restent fermées et déclarées explicitement.

La composition est assumée uniquement à la racine : `app.module.ts` assemble
les modules Nest et `typeorm-entities.ts` collecte les entités TypeORM dans un
ordre global. `platform/database` reçoit cette liste par paramètre et ses
migrations définissent leurs formats historiques localement ; il ne peut donc
plus importer le métier. Lorsqu'un adapter transversal a besoin d'une décision
métier, il déclare un port et la racine injecte l'implémentation.

La structure est verrouillée par `architecture:check` et `layout:audit`. Le
contrat d'architecture v4 possède une baseline vide, donc aucune dépendance
contraire à ces directions ne peut être ajoutée silencieusement.

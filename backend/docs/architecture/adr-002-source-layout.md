# ADR-002 — Arborescence source et frontières

Statut : accepté.

Le backend conserve une racine par capacité (`room`, `user`, `game`, etc.) au
lieu d’ajouter un conteneur `modules/`. Ce niveau supplémentaire ne porterait
aucune frontière TypeScript ou Nest et rendrait tous les imports plus longs.

Chaque capacité suit les rôles `domain`, `application`, `infrastructure` et
`module`. La présentation est considérée comme un adapter entrant : elle peut
donc vivre sous `infrastructure/presentation`. Le code de présentation appelle
l’application; le domaine et l’application n’importent jamais
l’infrastructure. Les dépendances entre capacités passent uniquement par leur
`public-api.ts` et sont déclarées dans le contrat d’architecture.

`common` n’est pas une couche métier. L’audit le découpe en composants logiques
indépendants (`auth`, `redis`, `ws`, `session`, `observability`, `validation`,
etc.). `common/utils` reste réservé aux primitives techniques stables et ne
peut dépendre d’aucune capacité métier. `realtime` est l’adapter transversal de
connexion WebSocket; le métier Room/Game reste dans ses capacités respectives.

Le moteur de jeu expose son SDK via `game/engine/sdk/public-api.ts`. Les jeux
ne peuvent pas importer le runtime interne. Les chemins historiques sous
`game/core/application/runtime` sont une implémentation privée du moteur et ne
définissent pas la direction des dépendances.

Le wiring Nest reste dans `module/`. Les fragments `providers.*` sont autorisés
uniquement lorsque la composition dépasse une taille raisonnable. Les façades
sont limitées aux frontières Room membership/lifecycle existantes; aucune
nouvelle façade de simple délégation n’est admise.

Les migrations restent globales pour préserver l’ordre total TypeORM. Leur nom
doit être descriptif et leur ownership doit être lisible dans ce nom ou leur
documentation. Une migration `auto` anonyme est interdite.

Ces décisions sont exécutables par `architecture:check`, `structure:check` et
`layout:audit`; elles remplacent une migration de répertoires sans changement
de frontière par des règles vérifiables à chaque CI.

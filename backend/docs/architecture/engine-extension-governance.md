# Gouvernance des profils JSON du moteur

## Frontière

`runtime/contracts`, les kits, effects, selectors et patterns forment le noyau
générique. Les noms de jeux ne sont pas des primitives de ce noyau. Les formes
JSON historiques qui ne se réduisent pas encore à ces primitives sont des
**profils d’auteur exceptionnels** sous `runtime/extensions`. Leur fichier
`program.ts` ne contient que des types effacés à la compilation : aucune règle,
fonction, constante, I/O ou décision exécutable ne peut y être déplacée.

Le document, le schéma et le compilateur génériques dépendent chacun d’une seule
frontière de catalogue : `json-program-extension-contract.ts`,
`json-program-extension-schemas.ts` et
`json-program-extension-compilers.ts`. Ajouter un jeu qui compose les mécaniques
existantes ne modifie aucun de ces fichiers. Le test du quarantième jeu crée 40
paquets JSON et vérifie qu’aucun fichier TypeScript auteur n’est nécessaire.

## Audit des profils existants

`tools/engine-extension-governance.json` constitue la revue exhaustive. Chaque
profil y déclare sa propriété JSON, sa classification et la mécanique qui motive
sa présence. L’audit recalcule ses consommateurs dans les 39 paquets officiels,
refuse un profil non classé, une déclaration exécutable, un second fichier dans
le profil ou une hausse au-dessus des 39 fichiers et 1 144 lignes actuels. Le
contrat bas niveau commun `TrackRaceProgram` a déjà supprimé 18 lignes dupliquées entre onze
variantes de course. L’audit publie aussi le ratio de contrats réutilisables et le nombre de profils à
consommateur unique. Une baisse est acceptée immédiatement ; une hausse casse la
CI et exige d’abord une généralisation explicite.

Les variantes de course partagent déjà les composants `movement.track`,
`dice.set`, `pawn.set`, le pattern `race`, les effets de mouvement, le RNG et la
validation commune de `json-race-program-validation.ts`. `board-game`,
`event-race`, `goose-race` et `pawn-race` sont les profils paramétrables. Les
profils de course encore spécifiques correspondent aux différences observables
énumérées dans le catalogue : livraison, ressources d’écosystème, capture,
protections, collisions, quiz ou chaînes de cases. Ils ne deviennent pas des
primitives génériques par leur emplacement.

Les jeux de familles et collections partagent les paquets, mains, inventaires,
ownership, transferts, selectors et conditions standard. Les profils restants
portent seulement leurs workflows distincts : demande de famille, assemblage
ordonné, cercle thématique, marché ou course avec zones. Une extraction future
n’est recevable que si au moins deux consommateurs réels partagent le même
invariant et les mêmes erreurs métier.

## Règles d’évolution

Une nouvelle mécanique commence par les effects, selectors, conditions, recipes
ou patterns fermés existants. Un profil spécifique est admis seulement si cette
composition ne peut exprimer le comportement, avec une entrée motivée dans le
catalogue et un budget total inférieur ou égal au précédent. Il reste identifié
comme spécifique et n’entre jamais dans `runtime/contracts` ou `shared`.

Le DSL reste fermé : pas de JavaScript, expression textuelle, variable, boucle,
scope, callback ou chargement propre à un jeu. Les recettes représentent des
opérations métier de haut niveau et bornées. Le chargeur de contenu résout toutes
les références de fichiers de façon générique avant le schéma, puis la compilation
valide les IDs, composants, capacités, effects, selectors, phases et actions.

La suppression d’un profil exige la conservation des scénarios déterministes du
jeu, la suppression de son entrée dans les trois catalogues et l’abaissement des
plafonds de gouvernance. Les audits de duplication, dead code, exports publics,
ownership, sérialisabilité, déterminisme et versionnement de `quality:check`
complètent cette vérification.

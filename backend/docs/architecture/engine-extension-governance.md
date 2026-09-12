# Gouvernance des extensions JSON du moteur

## Frontière du moteur

Le noyau générique se trouve dans `runtime/contracts`, `runtime/kits`,
`runtime/effects`, `runtime/selectors`, `runtime/patterns` et dans les vingt
primitives revues de `runtime/recipes/gameplay`. Ce dernier dossier ne peut plus
contenir un nom de jeu : son contenu exact est une liste blanche vérifiée par
`engine-extension-governance.cjs`.

Une mécanique qui reste propre à un jeu vit dans son dossier
`runtime/extensions/<profil>`. Elle y est explicitement classée comme
`game-specific` et n'est donc plus présentée comme une primitive du moteur. Son
module `extension.ts` possède en un seul endroit sa clé JSON, son schéma, son
compilateur, ses actions, ses handlers et sa validation. Ses recettes et ses
helpers restent dans le même dossier. Le fichier `program.ts` ne contient que
le contrat de données sérialisable et aucune logique exécutable.

Les sept contrats réellement réutilisables (`board-game`, `card-selection`,
`event-race`, `goose-race`, `grid-placement`, `judged-cards` et `pawn-race`)
portent le marqueur `Reusable JSON authoring extension`. Les autres contrats
portent le marqueur `Single-consumer JSON authoring extension` et une
justification mécanique propre dans le catalogue. Un commentaire générique ne
suffit plus à faire accepter un profil.

## Registre et compilation

`json-program-extension-registry.ts` est l'unique racine de composition. Son
ordre est explicite, déterministe et figé avec `Object.freeze`. Il n'utilise ni
découverte du système de fichiers, ni import dynamique, ni I/O à l'exécution.
Ajouter une extension demande une entrée dans cette racine et dans le catalogue
de gouvernance, sans ajouter de branche dans les compilateurs, les handlers,
l'initialisation ou la validation du moteur.

Les catalogues de contrats, schémas et compilateurs sont dérivés du registre.
Le compilateur d'actions collecte les recettes déclarées par le profil actif.
Les handlers, événements, composants, patterns, choix, règles d'initialisation
et validations passent par le même contrat générique. Les fichiers centraux ne
contiennent donc aucune clé de profil propre à un jeu.

Un nouveau jeu qui compose uniquement les primitives et profils existants reste
un paquet de données sous `game/games/**`. Il ne modifie aucun fichier
TypeScript. Le test de création du quarantième jeu et le garde « zéro TypeScript
dans `game/games/**` » protègent cette propriété.

## Mécaniques communes et comportements uniques

Les courses partagent les composants de piste, dés et pions, le pattern de
course, `TrackRaceProgram`, les effets de mouvement, le RNG du moteur et les
recettes génériques `track-round`, `movement-quiz`, `event-race`, `goose-race`
et `pawn-race`. Leurs extensions spécifiques ne conservent que les différences
observables : livraison, ressources, capture, protections, collisions, quiz ou
chaînes de cases.

Les jeux de cartes et de plateau composent de la même façon les primitives de
main, sélection, soumission, jugement, score, inventaire, propriété, transfert,
plateau et résolution d'effets. Les workflows encore uniques, par exemple les
phases de Gérard, les manches de Cat Pattes, la narration de Contes ou l'économie
de Sac, sont isolés dans leur extension. Une extraction vers le noyau n'est
admise que lorsque deux consommateurs réels partagent le même invariant et les
mêmes erreurs métier.

## Gardes bloquants

`engine-extension-governance.json` constitue la revue exhaustive. Chaque profil
déclare sa propriété JSON, sa classification et la mécanique qui justifie sa
présence. L'audit recalcule le nombre de jeux consommateurs et publie les
métriques suivantes : contrats, extensions enregistrées, primitives génériques,
lignes réutilisables et profils mono-consommateur. Il refuse :

- un profil absent du catalogue ou sans justification ;
- une logique exécutable dans `program.ts` ;
- une extension sans schéma, compilateur, actions, handlers ou validation ;
- une clé de jeu dans un fichier central ;
- une recette non revue dans le dossier générique ;
- une hausse des plafonds de dette sans modification explicite de la politique.

Le graphe TypeScript complet est testé sans cycle et ce test est bloquant dans
`quality:check`. Les mêmes contrôles maintiennent la fermeture du DSL, les
références inter-fichiers, l'immutabilité, la sérialisation, le versionnement,
les migrations déterministes, la restauration des snapshots et la convergence
des règles automatiques.

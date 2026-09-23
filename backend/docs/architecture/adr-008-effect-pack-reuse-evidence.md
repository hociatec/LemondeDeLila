# ADR-008 — Classification vérifiable des effect-packs

Date : 2026-09-23. Statut : accepté pour la classification ; aucune promotion implicite.

## Décision

Le format déclaratif JSON et la réutilisabilité du comportement sont deux propriétés
distinctes. Un pack configurable ne constitue pas à lui seul une primitive générique.
Le champ `scope` admet trois valeurs :

- `game-specific` : réutilisation non démontrée ; composition métier conservée hors du noyau.
- `reusable` : réutilisation dans plusieurs jeux mécaniquement différents, ou preuve
  explicite d'indépendance métier, avec justification et test exécutable.
- `engine-primitive` : mêmes preuves, plus un contrat indépendant explicitement désigné.

Les 38 packs actuels sont classés `game-specific`. Cette décision conservatrice
ne dit pas qu'ils sont impossibles à réutiliser : elle retire une garantie qui
n'était pas démontrée. Leur schéma, leur compilation et leurs règles ne changent pas.

## Contrôle et promotion

`tools/engine-effect-pack-governance.json` contient une classification et une raison
par pack. L'audit compare celle-ci à la déclaration TypeScript et calcule les
consommateurs à partir des vrais `game.json`.

Une promotion nécessite `reuseReview` avec :

- `kind: second-game` ou `independence-proof` ;
- `rationale` décrivant les mécaniques distinctes ou l'indépendance démontrée ;
- `test`, chemin vers un test `src/game/**/*.spec.ts`, exécuté par la suite CI.

`second-game` nécessite au moins deux documents mécaniquement distincts. Un jeu
recopié, renommé, reformatté ou traduit ne suffit pas. Le calcul normalise l'ordre
des propriétés et exclut les champs descriptifs ; ce filtre anti-duplication est
une condition nécessaire, pas une preuve automatique de généricité. La justification
et le test restent obligatoires. `independence-proof` permet une démonstration sans
inventer un second jeu de production. Une primitive doit en outre fournir
`primitiveContract`, chemin vers son contrat indépendant.

Le comptage des consommateurs ne modifie jamais `scope`. Toute promotion reste
un changement explicite et révisable, refusé si ses preuves sont absentes.

Les implémentations résident physiquement dans `rules/game-specific`,
`rules/reusable` ou `rules/primitives`, selon cette classification. Leurs schémas
et recettes appartiennent au même module ; `program.ts` ne contient que des types,
ce que vérifie l'audit de séparation. Les index sont générés au build depuis la
politique, avec un ordre explicite préservant la précédence de compilation.

Un nouveau pack doit fournir `introductionReview` : mécanismes existants essayés,
limitation concrète, ADR et test exécutable. Les nouvelles clés racines du noyau
exigent `coreRootFieldReviews` avec ADR et justification. Les 38 noms et les clés
historiques sont figés dans `engine-language-reference.json` ; ce fichier n'est
pas une référence à régénérer automatiquement pour contourner une revue.

## Maturité et évolution

La politique déclare aussi `maturity`, distinct de `scope`. Les packs actuels
restent `experimental` au sens de leur contrat architectural, sans remettre en
cause leur utilisation actuelle. `reusable` exige la preuve de réutilisation
ci-dessus. `stable` exige en plus `stabilityReview` : `contractVersion` entier
positif, `compatibilityPolicy` vers un document sous `docs/`, et au moins deux
fichiers de tests distincts sous `src/game/`. Ces tests sont exécutés par la suite
complète en CI ; une simple modification du libellé ne suffit pas à la promotion.

`npm run engine:evolution` mesure séparément les jeux JSON, les classifications
de réutilisation et les nouvelles identités de jeux, packs et primitives.
`-- --compare chemin/reference.json` permet la comparaison avec une release
antérieure. Sans argument, la référence initiale du 23 septembre 2026 est utilisée.
Chaque artefact de release inclut `engine-evolution.json`, réutilisable comme
référence suivante. Un dénominateur nul donne `null`, jamais un ratio infini.
Le test du compilateur exécute trois compositions nouvelles jusqu'à la victoire
sans ajouter de pack ou de primitive ; le rapport ne déduit jamais la généricité
du seul nombre de documents JSON.

## Vérification

`node --test tools/effect-pack-classification.spec.cjs tools/engine-effect-pack-governance.spec.cjs`
teste les fausses promotions, l'absence de preuve et la copie d'un jeu réel.
Les tests du registre, du compilateur et des 39 jeux protègent le comportement.

L'audit initial dépassait déjà de 12 lignes son plafond obsolète : 13 595 lignes
de production et 13 519 de comportement. Ces valeurs constatées avant modification
ont été documentées dans la politique ; cette reclassification n'ajoute aucune règle.

## Essai documenté : rallye à points de contrôle

Le [rapport du second jeu](../quality/second-game-checkpoint-rally.md) consigne
une tentative exécutable avec `race-directional-hazards` : circuit fermé,
points de contrôle et victoire au troisième point. Le contrat initial imposait sa
victoire de course. Le mode explicite `external` délègue désormais la victoire
à l'objectif JSON ; le rallye et son témoin composé de primitives passent leurs
tests et leur replay. Le classement reste `game-specific` : cet essai ne couvre
pas toutes les cartes et interactions du pack. Il ne vaut pas validation
des 37 autres packs. Le calcul des déplacements du pack utilise désormais la
politique du composant de piste, avec tests des quatre politiques et du replay.

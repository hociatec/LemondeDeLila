# Gouvernance des packs d'effets JSON du moteur

## Frontière

Le noyau générique vit dans `runtime/contracts`, `runtime/kits`,
`runtime/effects`, `runtime/selectors`, `runtime/patterns` et dans les vingt
fichiers revus de `runtime/recipes/gameplay`. Leur liste blanche interdit qu'une
recette propre à un jeu soit présentée comme générique.

Chaque contribution runtime est un pack d'effets générique. `program.ts` ne
contient que son contrat sérialisable ; `effect-pack.ts` possède sa clé JSON, son
schéma, sa compilation, ses actions, ses handlers et sa validation. Les 38 packs
enregistrés portent obligatoirement `scope: 'generic'` et un domaine parmi
`board`, `cards`, `choice`, `collection`, `race` et `spatial`. Il n'existe plus
de scope `game-specific` dans le contrat du moteur : cette valeur n'existe plus.

## Composition et nouveau jeu

Le registre est l'unique racine de composition. Il est explicite, ordonné,
figé, sans découverte du système de fichiers, import dynamique ou I/O runtime.
Les catalogues et compilateurs centraux sont dérivés de ses contributions et ne
connaissent aucune clé spécifique à un jeu.

Un nouveau jeu standard compose les primitives existantes uniquement avec
`game.json`, `manifest.json` et `rules.md`. Le test du quarantième jeu JSON-only
et l'interdiction de TypeScript de production dans `game/games/**` protègent
cette propriété.

## Généralisation fondée sur les usages

Chaque pack appartient à un domaine. Le registre expose aussi une vue figée par
domaine afin que les capacités cartes, plateau, course, collection, choix et
spatial soient consultables séparément. Le rapport recalcule ses consommateurs
réels, son scope, son domaine, sa raison, ses LOC, son nombre de consommateurs,
ses LOC par consommateur et le niveau de preuve de réutilisation. `designed`
signifie que la généricité est démontrée par le contrat mais pas encore par deux
jeux ; `demonstrated` exige plusieurs jeux. Tout pack d'au moins 300 lignes et
mono-consommateur exige une revue comparative détaillée (le seuil de 1 000
lignes est donc couvert avec une marge stricte).

L'analyse AST porte sur tous les fichiers de production des packs d'effets. Toute
séquence commune à plusieurs profils doit être extraite ou recevoir une décision
motivée dont l'empreinte est bloquante. La fin de sélection de pion commune à
quatre variantes de course est désormais une recette partagée. Deux séquences
restent composées à partir des kits existants : leurs cibles et leurs invariants
post-action diffèrent, donc un wrapper n'apporterait pas de contrat commun réel.

Le rapport agrège aussi les familles `race`, `collection`, `cards`, `choice`,
`board` et `spatial`. Cette vue rend obligatoire la comparaison des variantes :
une ressemblance structurelle nouvelle bloque tant qu'elle n'est pas extraite ou
explicitement revue. On ne fusionne pas deux mécaniques uniquement parce qu'elles
appartiennent au même domaine.

Son résumé publie trois preuves négatives explicites : zéro code de jeu exact,
zéro alias de jeu interdit et zéro import d'implémentation entre packs. Toute
valeur non nulle fait échouer l'audit avant la génération du rapport.

## Vocabulaire et dépendances internes

Les fichiers, schémas, types, clés de document, sorties compilées et motifs de
victoire utilisent les responsabilités mécaniques. Le garde
`forbiddenEngineVocabulary` balaie tout le TypeScript de production du runtime et
interdit le retour des alias de jeux historiques. Les noms, textes, identifiants
de contenu et codes de jeu restent dans `game/games/**`, où ils sont des données.

Un pack ne peut pas importer l'implémentation d'un autre pack. Toute primitive
partagée doit remonter dans les contrats, kits, patterns ou recettes génériques.
Cette direction est contrôlée automatiquement dans `quality:check`.

## Budgets et gardes

Les packs comptent 13 308 lignes de production, dont 76 lignes de métadonnées
`scope` et `domain`. Le comportement représente 13 232 lignes. La mécanique de
défausse est désormais paramétrable (ordre des valeurs, valeur spéciale et score
spécial) au lieu de coder une carte nommée dans le moteur. Les fichiers renommés
ont aussi été normalisés par le formateur ; les LOC restent volontairement des
comptages physiques. Ces valeurs sont des plafonds : une croissance ou une
nouvelle ressemblance impose une revue visible de la politique.

`quality:check` bloque également les cycles TypeScript sur tout `src`, la
fermeture et les limites du DSL, les références, l'immutabilité, l'isolation et
la sérialisation de l'état, les versions/migrations/snapshots, le déterminisme,
le RNG, l'atomicité, la propriété de l'état et les frontières publiques.

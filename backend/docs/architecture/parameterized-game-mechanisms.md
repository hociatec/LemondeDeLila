# Mécanismes paramétrables et règles de jeu

Le noyau exécute des mécanismes sans importer le catalogue des jeux. L'objectif
supplémentaire est de retirer également les associations propres aux jeux de
la bibliothèque `src/game/rules`. Déplacer une règle hors du noyau ne suffit
pas à la rendre paramétrable.

## Course à obstacles et contres

Le programme historique `pawScoring` reçoit désormais un bloc `mechanics`.
Les noms historiques du protocole (`pattes`, `parade`, `bot`, `paw-round.*`)
restent disponibles pour éviter une réécriture des cartes. Les identifiants
d'obstacles, de contres et de pouvoirs ne sont plus des énumérations de thèmes
dans le code.

Ce bloc définit :

- `statuses` : suffixes des statuts sous `statusPrefix`, y compris le préfixe
  des pouvoirs ;
- `counters` et `activationCounter` : contres disponibles et celui qui active
  les déplacements ;
- `obstacles` : identifiant, contre correspondant, blocage et plafond de
  déplacement éventuel ;
- `powers` : obstacles ignorés, contres désactivés et contournement de
  l'activation ;
- `moveLimits` : distances soumises à un nombre maximal d'utilisations par
  manche, avec un compteur indépendant pour chaque distance ;
- `finishReason` : motif de fin de partie.

Les références absentes, les identifiants dupliqués, les collisions de statuts
et les compteurs partagés accidentellement sont refusés à la compilation.
Il n'existe pas de configuration féline implicite dans le code : un ancien
document source doit recevoir le bloc explicite. Le contenu livré le possède.
Les identifiants de cartes, effets et statuts persistés sont conservés.
La migration de contenu `2 → 3` permet de continuer les sauvegardes existantes.

Le test `configurable-mechanics.spec.ts` utilise un autre thème, des identifiants
différents, une limite de déplacement de 7 et deux quotas indépendants. Il
vérifie le blocage, le contre, la protection, l'activation, la consommation des
quotas et leur remise à zéro à la manche suivante.

## Variantes économiques

Les identifiants de variantes sont fournis par le JSON. Le programme accepte
`defaultVariantId` ; à défaut, la première variante est sélectionnée par défaut.
Une valeur explicite doit référencer une variante existante. Le code n'exige
plus la variante `classic` et ne contient plus les sept noms du catalogue.
Les JSON livrés conservent leur ordre et ne changent pas.

## Collections et effets de cartes

Les espèces du programme historique `speciesTroops` deviennent des identifiants
de collection définis par les données. Les cartes doivent référencer un
identifiant déclaré. Le séparateur `:` reste réservé au format d'inventaire
persisté et ne peut pas figurer dans un identifiant de collection.

Les champs descriptifs `action` et `trap` ne sélectionnent plus le comportement
dans le code. Le ciblage dépend des effets exécutables : vol de carte ou échange.
Les anciens JSON restent valides, sans modification. Un test renomme les
collections, actions et pièges puis compare toutes les actions légales avec
leurs cibles, sur une main contenant toutes les cartes.

## Généralisation des autres modules

Les associations relevées lors de la première étape sont maintenant déclarées
dans les données. Les profils restent des familles de mécanismes : ils ne
sélectionnent jamais un comportement à partir du nom ou du code d'un jeu.

- Courses à ressources : correspondance faces/gains, effets des cases,
  comparaisons de ressources, relances, déplacements collectifs et classement.
- Rencontres et questions : collections libres, pioche enregistrée dans la
  continuation, catégorie de départage et motif de victoire configurables.
  Les anciennes continuations sans pioche utilisent `legacyQuizDeckId`.
- Protections : correspondances catégorie/statut, moment de consommation et
  déplacement conditionnel configurables.
- Soumissions jugées : les anciennes cartes spéciales sont reliées dans le JSON
  à des opérations génériques et à leur mode de ciblage ; tailles des mains,
  renouvellement et limite de soumission sont explicites.
- Défis narratifs : correspondances entre pioches et rôles, opérations ciblées,
  options, transferts de jetons, valeurs proposées et distances sont déclarées.
- Collections de cartes : catégories collectables et catégorie de perte libres ;
  les échanges entre familles utilisent un nombre configurable de familles.
- Scores partagés : catégories et statuts de blocage, multiplication, bonus,
  pénalité et division des gains viennent du JSON.
- Courses à cases : types de cases libres associés à des opérations de mouvement,
  pioche, gain, saut de tour ou arrivée. Les distances et seuils sont paramétrables.
- Courses à plusieurs pions : valeurs autorisant une entrée ou un tour
  supplémentaire, positions de départ et progression finale explicites.
- Vote anonyme : chaque question peut proposer de 2 à 100 réponses ; validation
  et actions proposées utilisent les réponses de la question courante.

Le protocole des effets directionnels a également quitté le noyau et appartient
à son module. Les anciens identifiants d'effets, statuts et choix restent des
alias de compatibilité. Par exemple, `multiple-five` conserve son identifiant
persisté mais utilise désormais `checkpointSpan`. Aucune table implicite ne
reconstitue les paramètres d'un jeu à partir de son identité.

Les jeux livrés reçoivent les valeurs correspondant à leurs règles existantes.
Les documents concernés déclarent une nouvelle version de contenu et une
migration des sauvegardes. Les cartes n'ont pas été réécrites pour renommer
leurs effets. Depuis le relevé précédant la séparation, 106 des 122 fichiers
JSON sont identiques ; 15 documents de jeu et le contenu déjà modifié de la
course à obstacles ont changé. Les 39 manifestes restent identiques.

## Vérification et portée

`parameterized-catalog.spec.ts` recompile les 39 définitions sous une identité
inconnue du catalogue, puis exécute et rejoue huit commandes au maximum pour
chacune. Seize profils reçoivent en plus des catégories, opérations liées ou
paramètres différents. Ce test vérifie la réutilisation et le déterminisme ;
il ne prétend pas parcourir toutes les branches de tous les jeux.

Les tests ciblés complètent cette vérification : distances et seuils modifiés,
gains et pertes de ressources, consommation de bonus, réponses variables,
références invalides et mécanismes déjà couverts lors de la première étape.
Les campagnes des jeux livrés, tests de parité et tests de frontière contrôlent
respectivement la compatibilité des comportements et l'indépendance du noyau.

Une nouvelle combinaison de données utilisant ces mécanismes ne demande pas de
faire connaître son jeu au moteur. Une règle nouvelle qui n'est exprimable par
aucune opération existante nécessite encore un mécanisme générique supplémentaire.
Le catalogue autorise un programme complet par document : la composition
arbitraire de plusieurs programmes complets n'est pas une capacité annoncée.

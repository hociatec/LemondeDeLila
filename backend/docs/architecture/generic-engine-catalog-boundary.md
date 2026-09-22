# Noyau indépendant du catalogue de jeux

Le noyau `src/game/engine/**` ne dépend plus de `game/rules`, `game/games`
ou `game/composition`, même indirectement et même par un import de type.
`engine:boundary:audit`, intégré à `quality:check`, vérifie cette frontière
avec la résolution TypeScript (alias, réexports, `require` et imports dynamiques
littéraux compris). Les tests du garde injectent aussi une dépendance indirecte
pour vérifier qu'elle est effectivement refusée.
Le garde interdit également les codes des jeux installés et leurs chemins de
catalogue dans les littéraux de production du moteur, y compris son infrastructure.

## Composition

- `engine/json/public-api.ts` fournit le compilateur générique, sans catalogue
  par défaut, et `createJsonGameCompiler(extensions)`.
- `rules/public-api.ts` assemble les 38 extensions utilisées par l'application.
  Le registre généré des jeux et les outils de contenu utilisent cette entrée.
- `rules/effect-packs`, `rules/schemas` et `rules/recipes` possèdent les règles
  de mécaniques, leurs schémas et leurs recettes spécialisées.
- `games/**` conserve les manifestes, compositions et contenus JSON.

La dépendance va des règles vers le moteur. Ajouter une extension consiste à
implémenter le contrat `defineJsonEffectPack`, puis à l'enregistrer dans la
bibliothèque de règles. Cela ne nécessite aucun changement du noyau ni de ses
listes de recettes, de propriétés de document ou de victoires.

Chaque compilateur capture un catalogue privé et figé, avec une copie des
schémas. Deux compilateurs peuvent avoir des catalogues différents. Les clés
réservées ou dupliquées sont refusées. Le schéma reste fermé : seules les
propriétés du noyau et des extensions fournies sont admises. Les recettes
d'action doivent être effectivement fournies par le programme compilé.
Les extensions possèdent aussi les données de leur vue publique : le noyau ne
maintient aucune liste de champs propres aux mécaniques. Les espaces réservés
du moteur restent protégés par le contrat commun.

## Compatibilité JSON et sessions

L'étape initiale de séparation ne modifiait aucun JSON de jeu : ni les clés existantes comme
`pawScoring`, ni les identifiants de cartes, ni les valeurs de règles. Les
versions de contenu et de définition restent identiques. Les schémas,
validateurs, calculs et mécanismes de sauvegarde existants sont conservés.
Les imports TypeScript internes et le générateur de registre ont été adaptés.
L'étape suivante de [paramétrage des mécanismes](parameterized-game-mechanisms.md)
ajoute les paramètres explicites aux modules qui possédaient encore des
associations figées, avec les migrations de contenu correspondantes. Les
preuves de JSON inchangés de la séparation sont donc historiques ; le bilan
actuel est de 106 fichiers identiques sur 122.

La sélection des pions et sa validation de capacité appartiennent désormais à
l'extension de plateau. Le noyau ne recherche plus une propriété `board` dans
les documents. De même, la préférence de recette d'un bot est fournie par
l'extension ; le noyau ne connaît plus la recette `board-draw`.
Le chemin du catalogue Mnémosyne appartient à la composition applicative. Le
stockage d'archives du moteur reçoit un répertoire explicite, sans valeur par
défaut associée à un jeu.

## Ce que garantit cette architecture

Le moteur ignore les jeux et leur catalogue. Une règle nouvelle peut être
fournie par une extension sans le modifier ; les tests exécutent deux exemples
absents du catalogue de production et vérifient leurs scores et leur victoire.

La bibliothèque fournit des familles de mécanismes paramétrables. Les
associations de cartes, catégories, cases et variantes sont définies par les
données ; leur [revue](game-mechanism-review.md) couvre les 38 modules.
Cela ne transforme pas toute règle imaginable en une primitive JSON déjà
disponible : une mécanique nouvelle peut nécessiter une nouvelle extension
TypeScript, mais pas une modification du noyau.

Les extensions actuelles restent des programmes complets : un document ne peut
en activer qu'un à la fois. Les primitives du noyau restent composables avec ce
programme. La fusion arbitraire de plusieurs programmes possédant chacun le
tour, les phases et la victoire n'est pas annoncée comme prise en charge.

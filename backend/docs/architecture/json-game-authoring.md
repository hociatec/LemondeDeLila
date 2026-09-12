# Jeux JSON, schéma 1

Un `game.json` reste un document de composition lisible et ne dépasse pas 300
lignes. Les catalogues, cartes, plateaux et questionnaires plus volumineux vont
dans `content/*.json`, puis sont référencés avec `{ "$content":
"content/fichier.json" }`. Le registre charge ces fichiers dans un ordre stable
et le compilateur applique le même résolveur borné à tous les jeux : les chemins,
pointeurs JSON, cycles, tailles et formes finales sont validés avant compilation.

Le registre importe maintenant le véritable `game.json` et le compile une seule
fois par paquet. Le manifeste fournit l'identité et les limites de joueurs ;
le document fournit les règles. Le même objet compilé alimente les définitions
et les paquets du registre. `create:game --json-only` produit un paquet jouable.

L'entrée `src/game/engine/json/public-api.ts` expose le compilateur et les
descripteurs JSON Schema exportables `urn:lila:game:1` et `urn:lila:effects:1`.
Les schémas sont immuables et tous les objets structurés sont fermés. Les champs
inconnus, nombres encodés en texte, fonctions, accesseurs, prototypes spéciaux,
cycles et arbres de plus de 64 niveaux ou 100 000 valeurs sont refusés.

Le profil actuel couvre les pioches, mains, pistes, dés, inventaires, pions, quiz, ressources et compteurs
initiaux, actions sans paramètres exécutant des effets, phases explicites et
victoires par seuil de score ou de ressource. Les effets utilisent la grammaire
canonique du moteur, avec conditions et cibles imbriquées. Les références sont
vérifiées avant de produire les callbacks moteur ; un effet personnalisé sans
résolveur ou une mécanique sans composant installé échoue à la compilation.

`setup.pawns` accepte des entrées `{ "setId": "tokens", "assignment":
"round-robin" }`. Les modes `round-robin`, `grouped` et `random` distribuent
`perPlayer` pions à chaque participant ; le mode aléatoire utilise le RNG
persisté. Une attribution répétée est rejetée à compilation, une quantité
insuffisante au démarrage avant l'application des valeurs initiales. Un
`setup.firstPlayer` numérique doit désigner un participant présent.

`initialization.deals` distribue un nombre borné de cartes depuis une pioche
vers une main pour chaque joueur ; une pioche de repli peut être déclarée pour
les catalogues épuisables. `initialization.gridPlacements` associe les positions
à l'ordre des joueurs et initialise explicitement les couches de grille vides.
Les pioches, mains, catalogues acceptés, grilles, coordonnées et capacités sont
validés avant le démarrage. Olympia et Corridor utilisent ces déclarations et
n'ont plus de module `setup-rules.ts`.

Le champ optionnel `patterns` accepte les unions fermées `race`,
`push-your-luck` et `simultaneous-answers`. Un pattern `race` déclare sa piste,
ses dés et ses effets de cases ; ses composants passent les mêmes validations
de références et de collisions que les composants explicites. La composition
rejette aussi les identifiants de patterns dupliqués et les politiques de tour
incompatibles. Aucune fonction ni chaîne de code exécutable n'est acceptée.

Le champ optionnel `board` décrit une primitive de parcours : déplacement,
résolution ordonnée des cases et continuation après un choix. Ses capacités
optionnelles couvrent la distribution, le choix de pions, la collecte, le quiz
et les échanges. Les actions `board-roll` et `board-draw` sont des recipes du
moteur. Les opérations et leurs `bindings` forment des unions fermées ; elles
n'acceptent aucun callback auteur. La victoire `by-board` est déclenchée par les
opérations d'arrivée. Les références de composants, phases, catalogues et tags,
les collisions de choix et les données d'effets sont validées à compilation.

Panier Express est entièrement décrit par son paquet JSON en production :
40 cases, 58 cartes, 30 quiz, six pions, distribution, raccourcis, choix et
victoire. Aucun fichier TypeScript de production ne subsiste dans son paquet.
Trois traces de 150 commandes comparent les événements métier avec l'ancienne
implémentation ; une simulation complète atteint la victoire en 1 048 commandes.
La version de règles 2 refuse les anciens snapshots dont les continuations
avaient une autre forme. Il faut terminer ces parties avant le déploiement ou
effectuer une conversion hors ligne explicitement validée.

Les paramètres arbitraires d'actions, votes et callbacks auteur ne font pas
partie de ce profil JSON. Les champs non pris en charge sont refusés, jamais
ignorés. Les autres jeux peuvent toujours utiliser le SDK TypeScript.

Le programme `grid` et la recette `grid-place` couvrent le placement de marques
sur une grille rectangulaire, la victoire par alignement et le match nul sur
grille pleine. `by-grid` délègue la victoire au pattern Grid. Le bot cherche
d'abord un alignement gagnant, puis bloque les adversaires actifs dans leur ordre,
puis suit `preferredCells` et enfin l'ordre des cellules libres. Le choix initial
des pions est optionnel. Dimensions, longueur d'alignement, cellules préférées,
pions et namespace des événements sont vérifiés avant démarrage.

Morpion utilise ce programme, `game.json` et `content/pawns.json`, sans fichier
TypeScript de production. Trois parties complètes reproduisent exactement les
événements capturés avant migration. Une grille rectangulaire 2 × 4 est également
testée avec la même recette. Les règles de Morpion passent en version 2 : la
représentation de sa définition change et les snapshots de version 1 sont refusés
avant mutation. Sa sous-catégorie est normalisée en identifiant `VentsSacres`.
Le champ optionnel `documentation` des actions conserve les explications auteur.

`eventRace` et `event-race-roll` couvrent les courses avec pioche immédiate
d'événements aux cases. Le programme référence une piste et ses dés, les pioches
par case et une sélection initiale de pion. `landingEffectId` associe un effet
fermé à la nouvelle résolution de la case courante après déplacement. La
victoire `by-event-race` exige un pattern de course avec victoire à l'arrivée.
La chaîne réutilise les limites de convergence du moteur d'effets.

`deliveryRace` et `delivery-race-roll` couvrent une course de livraison : une
carte client persistante désigne une destination numérique, une carte événement
désigne la position qui bloque le trajet, et le score cible termine la partie.
Les attributs numériques, pistes, dés, pioches, main et plateau sont contrôlés à
la compilation. Taxi Express utilise cette recette sans TypeScript de production.

`gooseRace` et `goose-race-roll` décrivent le parcours classique du Jeu de
l'Oie : rebond à l'arrivée, répétition du lancer sur une Oie, pont, auberge,
prison, puits, labyrinthe, mort et dé magique. La profondeur des enchaînements,
les destinations, la piste, les dés, les phases et la capacité des pions sont
validés avant le démarrage. Le Jeu de l'Oie utilise ce programme sans TypeScript
de production.

`collectionRace` et `collection-race-roll` décrivent une course qui collecte
une carte et incrémente une ressource selon la zone atteinte. À l'arrivée, le
classement compare le score total puis chaque zone dans l'ordre déclaré. Les
plages, pioches, attributs `zoneId`, ressources, cases et composants de
projection sont validés avant démarrage. Mon Village, Mon Histoire utilise ce
programme sans TypeScript de production.

`ecosystemRace` et `ecosystem-race-roll` décrivent une progression où les faces
du dé produisent des ressources, où certaines cases modifient la collecte et où
un danger déplace tous les joueurs. La victoire classe les joueurs par ressources
totales puis par nourriture et œufs. Piste, faces, dés, ressources, compteur et
événement résolu sont vérifiés avant démarrage. Primalis utilise ce programme
sans TypeScript de production.

`pirateRace` et `pirate-race-roll` décrivent la course au coffre de Pirates en
vadrouille : résolution des cases, pioche cyclique, collection publique bornée,
pièces d'or, immunité consommable et vol d'un trésor ciblé. La piste, les
paquets, les inventaires, la ressource et les seuils sont contrôlés avant le
démarrage. La condition du coffre ouvre la victoire ou impose le recul déclaré.
Pirates en vadrouille utilise ce programme sans TypeScript de production.

`parade` avec `parade-play` et `parade-pass` décrit une suite ordonnée de
cartes distribuées entre les joueurs. Seule la valeur attendue peut rejoindre
la défausse ; les valeurs spéciales attribuent les ressources déclarées et le
classement final applique leur pondération. Le compilateur contrôle l'unicité
des cartes et valeurs, l'exhaustivité de la séquence, la main, la pioche et les
ressources. La Parade Sucrée utilise ce programme sans TypeScript de production.

`natureFamilies` avec `nature-families-ask` et `nature-families-pass` décrit la
demande de cartes Famille, la pioche en cas d'échec, les familles complètes et
la jauge collective de pollution. `cards.sets` et l'exclusion déclarative de
cartes lors de la distribution initiale permettent de conserver les mains de
départ composées uniquement de cartes Famille. Les cartes, ensembles, quiz,
compteur et seuils sont vérifiés avant le démarrage. Dame Nature utilise ce
programme sans TypeScript de production.

`carAssembly` avec ses actions de pose, défausse et passe décrit une construction
ordonnée par catégories. Les pièces courantes et celles des trois voitures
terminées vivent dans des inventaires moteur ; les ressources conservent le
nombre de voitures et l'indice du nom attribué à chaque emplacement. La pioche
automatique, la vue `progress` et l'ordre global des noms sont fournis par la
recette. Pimp My Ride utilise ce programme sans état auteur ni TypeScript de
production.

Le pattern JSON `market` installe l'inventaire, le marché, la monnaie, les prix
bornés, le compteur de tours et la victoire par valeur nette. `wonderMarket`
ajoute les six actions acheter, vendre, rumeur, protéger, voler et passer, avec
validation serveur et bot déterministe. Le Marché des Merveilles utilise ce
programme sans TypeScript de production.

`mamanRace` et `maman-race-roll` décrivent la forêt de Tout près de Maman :
rebond à l'arrivée, jet bonus consommable, cases chaînées, cartes d'effets,
rencontre ciblée, jet supplémentaire et condition en jetons d'eucalyptus. Les
effets personnalisés sont fournis par le moteur et leurs références sont
validées avec la piste, le dé, la pioche et la ressource.

Aventure Sauvage utilise ce programme sans TypeScript de production. Ses cartes
conservent leurs identifiants numériques, textes et effets ; les trois traces
historiques reproduisent les événements jusqu'à la victoire. La version des
règles passe de 2 à 3 ; les snapshots des anciennes règles sont refusés.

`schemaVersion` versionne la grammaire auteur. `definitionVersion` alimente
`rulesVersion`, indépendamment de la version de l'algorithme moteur et du schéma
d'état. `contentVersion` est l'étiquette auteur incluse dans le document ;
l'identité effective du contenu est calculée sur le document complet. Une
modification de règle change donc cette identité même si l'auteur oublie de
modifier son étiquette. Le chargeur de snapshots refuse alors la restauration
avec les nouvelles règles. Les releases externes utilisent leur SHA-256 vérifié.
L'ordre des clés servant à l'identité est indépendant de la locale du serveur.

La politique de versionnement est la suivante :

- `schemaVersion` change lorsqu'une syntaxe acceptée change de sens ou cesse
  d'être valide. Les ajouts optionnels qui préservent les documents existants
  gardent le schéma 1. Le compilateur actuel accepte uniquement le nombre `1` ;
  aucune conversion implicite de grammaire n'est effectuée.
- `definitionVersion` change pour toute modification d'une règle observable :
  actions autorisées, effets, paramètres, ordre, victoire, bot ou continuation.
  Une migration TypeScript → JSON qui change la représentation des continuations
  change aussi cette version. Les anciennes règles sont refusées à restauration.
- `contentVersion` change lors d'un ajout, retrait, réordonnancement ou changement
  de valeur dans les catalogues, y compris un texte affiché. Une simple extraction
  en fichiers `$content` qui conserve exactement le document résolu ne la change
  pas. L'empreinte effective couvre néanmoins tout le document résolu et bloque
  une modification oubliée par l'auteur.

Le moteur versionne séparément ses algorithmes déterministes : la version 2
reconnaît les cartes objets dans `has-card` et refuse les snapshots moteur 1.
Le schéma d'état n'est pas incrémenté pour un simple changement d'algorithme.
Les migrations et la contrainte de déploiement sont décrites dans
`engine-snapshot-migrations.md` ; aucune étiquette ne doit être réécrite pour
contourner un refus de restauration.

Le paquet `src/game/testing/fixtures/json-course` démontre une partie entièrement
JSON jusqu'à la victoire, avec distribution, placement, ressources et tours.
Il reste volontairement un exemple de test, hors catalogue de production.

## Composition et fichiers de contenu

Le `game.json` de Panier compose cinq fichiers sous `content/` : `board.json`,
`pawns.json`, `cards.json`, `quizzes.json` et `products.json`. À toute position
de la composition, un objet contenant uniquement `$content` peut remplacer une
valeur. Par exemple :

```json
{ "$content": "content/cards.json#/events" }
```

Sans fragment, la référence sélectionne le document entier. Le fragment suit
JSON Pointer : `/` sépare les clés, `~1` représente un slash et `~0` un tilde.
Les références peuvent être imbriquées dans les fichiers de contenu. Les tableaux
conservent leur ordre. Aucun chemin absolu, URL, remontée `..`, lien symbolique
ou lecture de fichier depuis le moteur n'est autorisé.

La génération du registre découvre les fichiers et produit leurs imports
statiques. Elle transmet au compilateur un dictionnaire `JsonContentAssets`
dont les clés sont les chemins relatifs sous `content/`. Le compilateur assemble
ces données avec `resolveJsonContent`, puis applique `jsonGameSchema` au document
**résolu**. Ce schéma décrit les règles compilables, pas les références de paquet.
Une référence absente, un pointeur invalide, un cycle ou un objet mélangeant
`$content` et d'autres champs provoque un rejet avant création du jeu.

Un paquet accepte au maximum 256 fichiers, 8 Mio de fichiers de contenu et
100 000 valeurs après expansion, sur une profondeur maximale de 64. Les limites
JSON usuelles s'appliquent aussi aux entrées et à la taille du texte résolu.
Les noms de fichiers et dossiers emploient lettres ASCII, chiffres, `_` et `-` ;
les fichiers portent l'extension `.json`.

L'identité de contenu est calculée sur la définition résolue. Déplacer des
données vers un autre fichier sans changer cette définition conserve donc
l'identité et la compatibilité des snapshots. Les releases externes transportent
toujours cette définition complète ; leurs références ne déclenchent aucune
lecture de fichiers sur le serveur.

## Sélecteurs de joueurs

Les effets et leurs conditions partagent la même union `EffectTarget` : `self`,
`player`, `next`, `previous`, `all-players`, `all-opponents`, `random-player`,
`random-opponent`, `leader`, `last`, `chosen-player` et `chosen-opponent`.
`leader` et `last` comparent les scores des joueurs actifs, y compris les scores
négatifs. Leur champ obligatoire `ties` choisit `all` (tous les ex æquo dans
l'ordre des joueurs), `lowest-id` (identifiant numérique minimal) ou `random`
(tirage par le RNG persisté du moteur).

`next` et `previous` acceptent `order: "turn"` pour suivre le sens du tour parmi
les joueurs actifs, à partir de l'acteur ou du joueur courant. L'ordre
`seating` conserve le voisinage des places autour de l'acteur ; sans acteur,
le comportement historique utilise le voisin du joueur courant dans le sens
du tour. Omettre `order` conserve ce comportement historique.

Les tirages ciblent les joueurs actifs et utilisent exclusivement le RNG moteur.
Une sélection sans candidat retourne une liste vide. Les choix interactifs
conservent leur continuation et leur politique de timeout dans le snapshot.

## Conditions métier

Les victoires standard comprennent `score-at-least`, `resource-at-least`,
`track-finish` (`trackId`, `ties`) et `last-player`. Cette dernière termine
sans gagnant si tous les joueurs sont éliminés ensemble. `rounds-completed`
déclare `amount`, `participants` (`active` ou `all`), `ties` (`all` ou
`lowest-id`) et une liste ordonnée `ranking` de critères `{ "kind": "score",
"direction": "desc" }` ou `{ "kind": "resource", "resource": "stars",
"direction": "asc" }`. Les identifiants de pistes et ressources sont validés
avant démarrage. Le classement conserve les ex æquo ; `ties` décide du ou des
gagnants parmi le premier groupe. Le champ `reason` est facultatif.

Les effets `start-round` et `end-round` passent par le contrôleur de manches.
Commencer une manche déjà en cours ou terminer une manche non commencée échoue
atomiquement. `start-round` choisit le joueur courant comme premier joueur.
`eliminate-player` accepte les cibles standard du moteur. Ces effets permettent
de construire les transitions de manches et d'élimination dans les actions JSON.

Les conditions `all`, `any` et `not` composent la même union fermée que les
effets conditionnels. `score` et `resource` comparent une valeur avec `amount` ;
`inventory-count` compare le nombre d'objets d'un inventaire, éventuellement
filtré par `itemId`. Les opérateurs sont `eq`, `ne`, `lt`, `lte`, `gt`, `gte`.
`owns-asset` vérifie une propriété à partir de `registryId` et `assetId` ; le
composant JSON associé est `ownership.registry`. Les références de ressources,
d'inventaires, d'objets et de propriétés sont validées à compilation.

Les conditions existantes `has-resource`, `has-status`, `has-card` et
`track-position` restent disponibles. `has-card` reconnaît aussi les cartes
décrites par un objet avec identifiant. Une cible multiple exige que tous ses
joueurs satisfassent la condition. Ces lectures ne modifient pas le contenu
partagé ; leurs résultats suivent exclusivement l'état de la partie.

## Limites du langage et échanges

Une action `selectCards` sélectionne des occurrences physiques depuis une
source `deck`, `hand` ou `discard`. Elle déclare `choiceId`, `source` (avec
`deckId` et, pour une main, `handId`), `destination` (`discard` ou `hand`),
`min`, `max` et `shortfall`. Les propriétaires de mains acceptent `actor`,
`next` ou `previous` dans l'ordre des places. Le filtre optionnel comprend
`includeIds` et `excludeIds` ; les identifiants sont validés sur le catalogue.
Deux exemplaires identiques restent deux choix distincts.

`shortfall: "reject"` rend indisponible une sélection sous le minimum ;
`"available"` abaisse les bornes au nombre disponible. Le timeout optionnel
déclare `afterMs` et `strategy` (`first`, `last`, `random`). Il résout une liste
de la taille minimale ; `random` utilise le RNG persisté. La sélection est
bornée à 1 000 candidats et n'est visible que du joueur concerné. Après le
transfert, `effects` exécute les effets standards, puis `completeTurn: true`
termine le tour. La continuation privée est persistée et une source modifiée
pendant le choix est rejetée avant tout transfert.

Les effets, conditions et cibles utilisent respectivement `GameEffectInstruction`,
`EffectCondition` et `EffectTarget`, avec les schémas fermés correspondants dans
`effect-json-schema.ts`. Les composants, les actions et les recettes JSON
emploient ces mêmes unions. Un nouveau `kind` exige son contrat, son schéma,
sa validation de références et son exécuteur moteur ; un identifiant `custom`
ne permet pas de charger du code et doit désigner un résolveur déjà enregistré.

Les champs inconnus, callbacks, accesseurs, expressions numériques textuelles,
imports, variables et boucles sont refusés. Les champs descriptifs restent du
texte inerte. Une recette représente une mécanique métier bornée ; elle ne
fournit pas de variables, de portée ou d'interpréteur de code à l'auteur.

`exchange-random-cards` prend `handId`, `left` et `right` (cibles canoniques).
Il échange une carte tirée dans chaque main avec le RNG persisté. Si une seule
main contient une carte, celle-ci est transférée ; deux mains vides ou deux
cibles identiques ne modifient pas les mains. `swap-hands` échange les mains
entières. Les cartes restent identifiées et leur contenu partagé reste immuable.

## Échange de ressources

`exchange-resources` échange deux offres positives entre les cibles résolues.
La disponibilité des deux offres et tous les soldes finaux sont vérifiés avant
la première mutation. Une offre insuffisante rejette toute l'action.

```json
{
  "kind": "exchange-resources",
  "left": { "kind": "self" },
  "right": { "kind": "next" },
  "leftOffer": { "resource": "gold", "amount": 2 },
  "rightOffer": { "resource": "wood", "amount": 3 }
}
```

Les deux ressources doivent figurer dans `resourceIds`. Les quantités sont des
entiers strictement positifs. Les offres d'une même ressource sont compensées
avant vérification des bornes numériques. Une cible identique des deux côtés
ne produit aucun transfert. Les cibles choisies utilisent les continuations
standards du moteur ; aucun callback auteur n'est nécessaire.

### Sélection de cartes déléguée et attributs

selectCards.chooser accepte actor (défaut), next ou previous. source.owner et
destination.owner restent relatifs à l'initiateur, même quand un autre joueur
choisit. Seul le joueur désigné voit les candidats ou peut répondre. Son timeout
utilise la continuation persistée. Les effets suivants s'exécutent dans le contexte
du joueur qui résout le choix. Les anciennes continuations sans requesterId
restent compatibles avec le comportement par défaut, dont la forme ne change pas.

Les cartes objet peuvent déclarer attributes, un dictionnaire de valeurs
scalaires (texte de 256 caractères maximum, nombre fini, booléen ou null).
filter.attributes exige l'égalité de toutes les valeurs indiquées et se combine
avec includeIds et excludeIds. Un attribut absent ne correspond pas à null.
Les clés inconnues du catalogue ou dangereuses sont refusées avant démarrage.
Les autres propriétés de carte restent contrôlées par le schéma fermé.
Exemple : { "attributes": { "color": "red", "points": 2 }, "excludeIds": ["joker"] }.

Le même filtre fonctionne sur le paquet, les mains et la défausse : les attributs
proviennent du catalogue, même si l'état persiste uniquement les identifiants.
shortfall: available peut ramener min et max à zéro ; une réponse vide termine
la sélection et ses effets de suivi. Ces champs étendent la grammaire JSON 1 ;
l'empreinte du contenu résolu empêche de mélanger une définition modifiée et un
snapshot d'une autre définition. Le contrat SDK TypeScript ne change pas.

### Course de pions

Le pattern pawn-race déclare le catalogue de pions, perPlayer, spaces, la position
de départ, le lancer d'entrée, la case d'entrée et les règles de dépassement. Il
compose le kit de pions et les dés standards. Le programme pawnRace déclare
setId, diceId, choiceId, finishAt, finishReason et extraTurnRolls. Une action
recipe: pawn-race-roll lance le dé, joue l'unique mouvement légal, passe s'il
n'y en a aucun ou ouvre un choix privé lorsqu'il y en a plusieurs. Le dernier
lancer enregistré reste l'autorité pour les tours supplémentaires. L'arrivée
de tous les pions déclenche victory: by-pawn-race. Les références, la capacité
des pions, la case d'arrivée et les valeurs de dés sont validées au chargement.

L'Odyssée des Quatre Cieux est déclarée uniquement par manifest.json et game.json.
Ses 16 pions, 62 positions, entrée sur six, arrivée exacte et tours supplémentaires
sont des paramètres du moteur. Trois parties complètes (graines 1, 7 et 42)
produisent exactement les mêmes traces métier que la version TypeScript.

### Cercles de cartes

Le programme `cardCircles` déclare un paquet, des mains privées, un inventaire
public, un catalogue de cartes thématiques, l'ordre des thèmes, les limites de
main et le nombre de cercles requis. Les recettes `card-circles-form`,
`card-circles-discard` et `card-circles-pass` sont exécutées par le moteur. La
formation exige exactement une carte de chaque thème, remplit ensuite la main
jusqu'au minimum déclaré et termine la partie lorsque l'objectif est atteint.

Cercles Sacrés utilise ce programme avec 90 cartes, six thèmes et un objectif de
trois cercles. Son bot emploie les mêmes combinaisons validées que l'action et
défausse tant que la main dépasse la limite.

### Domaine de mine

Le programme `mineDomain` déclare le paquet, les mains, l'inventaire public, la
limite de main et les cartes avec leurs effets. Les recettes
`mine-domain-play` et `mine-domain-pass` conservent les trésors et objets dans le
domaine, résolvent immédiatement événements, monstres et effondrements, puis
maintiennent le score depuis l'inventaire. Les effets propres à la mine sont des
handlers fermés du moteur et restent référencés par des données JSON.

### Course hantée

Le programme `frousseRace` déclare la piste, le dé, le paquet, la sélection de
pions, les cases, les cartes et les identifiants de statuts. La recette
`frousse-race-roll` applique les modificateurs de lancer, les protections par
catégorie et les déplacements récursifs bornés. Les effets de déplacement,
téléportation, échange et mouvement des adversaires restent des handlers fermés
du moteur.

### Course équestre aller-retour

Le programme `galoponsRace` déclare la piste, le dé, le paquet, la sélection de
pions, les cases, les cartes, la ressource pomme et les identifiants de dette et
de sens de déplacement. La recette `galopons-race-roll` paie les dettes avant le
lancer, gère le rebond aux extrémités, les collisions, les cases spéciales et les
résolutions de cartes récursives bornées. Galopons ensemble utilise uniquement
son manifeste, `game.json` et son catalogue JSON ; trois traces de 300 commandes
aux graines 1, 7 et 42 sont identiques à celles de l'ancienne définition.

### Familles de métiers

Le programme `professionFamilies` déclare le paquet, les mains privées, les
familles publiques, les cartes métier et spéciales, ainsi que les ressources et
statuts utilisés par leurs effets. La recette `profession-families-request`
énumère les demandes autorisées, transfère la carte demandée ou pioche après un
échec, complète les familles et calcule les gagnants. Les effets spéciaux restent
des handlers fermés du moteur. Les Mains de la Terre conserve des traces exactes
sur 900 commandes aux graines 1, 7 et 42.

### Course de familles animales

Le programme `fouleesRace` déclare les familles de pions, la piste commune, les
couloirs d'arrivée et les cases sûres. La recette `foulees-race-roll` calcule les
mouvements légaux, bloque le passage par un adversaire, capture hors refuge et
ouvre un choix persistant lorsqu'il existe plusieurs déplacements. Foulées
fantastiques conserve des traces exactes sur 900 commandes aux graines 1, 7 et 42.

### Course galactique

Le programme `galaxyRace` déclare la piste, le dé, les paquets de questions,
défis et événements, les cases et les deux choix persistants. La recette
`galaxy-race-roll` résout les déplacements, sauts de tour, téléportations,
échanges et cartes avec une profondeur bornée. Les effets propres à Mission
Galaxie restent des handlers fermés du moteur. Le jeu conserve des traces
exactes sur 900 commandes aux graines 1, 7 et 42.

### Troupes de singes

Le programme `bananaTroops` déclare le paquet, les mains, l'inventaire public,
les espèces et les cartes. Les recettes `banana-troops-play` et
`banana-troops-pass` valident les coups complets, appliquent les actions et
pièges, bornent la main et détectent la collection gagnante. La Bande à Banane
conserve des traces exactes sur 900 commandes aux graines 1, 7 et 42.

### Course de Minuit

Le programme `midnightRace` déclare la piste avec rebond, les pions, le paquet,
les cases, les quiz et les statuts consommables. La recette
`midnight-race-roll` gère les collisions, déplacements récursifs, protections,
pioches forcées et choix persistants. En Attendant Minuit conserve des traces
exactes sur 900 commandes aux graines 1, 7 et 42.

### Réponses absurdes et vote

Le programme `nawak` déclare les défis, les sessions de réponse et de vote et
le seuil de score. Les recettes `nawak-choose` et `nawak-vote` conservent le
secret jusqu'à la révélation, attribuent les votes et exposent la dernière
manche depuis l'état persistant. Nawak conserve des traces exactes sur 900
commandes aux graines 1, 7 et 42.

### Cartes de prestige

Le programme `olympia` déclare les paquets autorisés, la main partagée, les
cartes et le seuil de prestige. Les recettes de pioche, jeu et passe appliquent
les effets fermés du moteur, les blocages, les échanges et le départage stable.
Olympia conserve des traces exactes sur 900 commandes aux graines 1, 7 et 42.

### Bataille à égalités successives

Le programme `zigEtZag` déclare le paquet, les mains privées et les cartes avec
leur famille, leur couleur et les contraintes des jokers. La recette
`zig-et-zag-draw` alterne les cartes visibles et cachées lors d'une égalité,
transfère la table au vainqueur et prélève le bonus prévu chez l'adversaire. Zig
et Zag conserve exactement son état métier et son journal sur 900 commandes aux
graines 1, 7 et 42.

### Quiz configurable simultané

Le programme `mnemosyne` déclare les catégories, les questions sources et les
valeurs de configuration. Le moteur filtre les questions validées, construit la
banque globale et les banques par catégorie, mélange les réponses de manière
stable et gère la configuration propriétaire, les réponses simultanées, les
délais et le score. L'Arche de Mnémosyne conserve exactement son état métier et
son journal sur 900 commandes aux graines 1, 7 et 42.

### Grille de déplacement et murs

Le programme `corridor` déclare la grille, les pions, les positions initiales et
la réserve configurable de murs. Les recettes `corridor-move` et
`corridor-place-wall` calculent les déplacements avec saut ou diagonale,
interdisent les chevauchements et vérifient par parcours de graphe qu'un chemin
reste ouvert pour chaque joueur. Le Corridor conserve exactement son journal,
son état métier et son état moteur sur les graines 1, 7 et 42, pour les scénarios
de déplacement, saut, victoire et placement de murs.

### Manches de cartes avec élimination

Le programme `lama` déclare le paquet maximal, les mains privées, les paramètres
de manche et les choix temporisés. Ses quatre recettes couvrent jeu, pioche,
passe et sortie; le moteur calcule les pénalités uniques, rend les jetons,
élimine au seuil configuré et choisit le gagnant avec un départage stable. LAMA
conserve exactement son journal, son état métier et son état moteur sur 900
commandes aux graines 1, 7 et 42.

### Jeu de défausse à manches

Le programme `lama` déclare le paquet maximal, la main privée, les seuils et les
choix de pause ou de rendu de jetons. Les recettes de jeu, pioche, passe et sortie
gèrent les manches, les pénalités par valeur distincte, l'élimination et le
départage stable. LAMA conserve exactement son journal, son état métier et son
état moteur sur 900 commandes aux graines 1, 7 et 42.

### Course à cartes et cases en chaîne

Le programme `balloonRace` déclare la piste, les pions, les cartes Loufoques et
la profondeur maximale de résolution. Les recettes `balloon-race-roll` et
`balloon-race-draw` résolvent les cases Bonus, Piège, Glissade, Tornade, Chaton
et Folie, ainsi que les déplacements déclenchés par les cartes. L'attente de
pioche est conservée par le kit de statuts et les anciennes sauvegardes portant
le booléen historique restent lisibles pendant leur continuation.

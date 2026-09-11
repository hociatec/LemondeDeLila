# Revue des jeux, du SDK et des mécaniques

État historique de ce lot. La [troisième passe](patterns-caches-jobs-review-2026-09-08.md)
complète ensuite les capacités 136–140 et supprime les cycles 170–171 et 192–193.
L'unification des catalogues et le SDK 4.0 sont décrits dans
[le protocole actuel](game-content-loading.md) ; les constats ci-dessous sur
les anciennes fonctions de chargement décrivent l'état antérieur.

Périmètre : les 100 premières exigences encore présentes au début de ce lot,
du point 6 au point 171, avec la numérotation d'origine. Une revue terminée
ne signifie pas que toutes les exigences de réalisation sont satisfaites.

## Contenus et visibilité

Les assets empaquetés et les releases utilisent `readContainedContent` pour
la résolution et la lecture : chemin relatif, séparation de la racine,
résolution réelle des liens et refus des sorties du dossier. La découverte
d'un jeu reste dans `FilesystemContentReader`, unique lecteur des assets du
SDK. Une release sélectionne sa racine et son manifeste, puis utilise la
même frontière. Les données JSON importées comme modules n'effectuent pas
une seconde recherche de fichiers pendant l'exécution d'une commande.

Les déclarations `defineGameContent` et `loadGameContent` des jeux précisent
`formatVersion: 1`. Ce numéro décrit le format normalisé complet du catalogue,
distinct des versions propres aux fichiers sources (certains sont au format 2)
et du hash de leurs valeurs. Un changement du format normalisé modifie
l'identité de contenu ; le format 1 conserve les identités existantes.
Le générateur produit également ce numéro. Les tests couvrent les versions
invalides, les chemins et une jonction sortant de la racine.

La coexistence de `freezeGameContent`, `defineGameContent` et
`loadGameContent` reste une dette : les points 14 et 15 restent ouverts.
Les références immobilières de Sac à Malices utilisent encore des noms ;
les points 25, 27, 29 et 30 ne sont pas déclarés achevés.

La visibilité logique est désormais :

| Surface | Consommateurs | Engagement |
| --- | --- | --- |
| `engine/sdk/public-api.ts` | auteurs des jeux | 74 exports explicites, types inclus, contrat contrôlé par hash |
| `engine/testing/public-api.ts` | tests | outils de simulation, exclus de l'import de production des jeux |
| `engine/public-api.ts` | composition et services applicatifs | contrats d'intégration, pas de kit auteur |
| `engine/runtime/**` | moteur et ses tests | implémentations internes, imports directs entre responsabilités |

L'ancien `runtime/public-api.ts` exportait des centaines de symboles pour
un seul fichier de tests et aucun consommateur de production. Il est supprimé ;
le test importe les responsabilités concernées. Le contrôle AST interdit déjà
aux jeux les imports internes, y compris les imports de types et dynamiques.
Les contrats auteur référencent encore des contrôleurs runtime : les points
63 à 65 restent ouverts, malgré la suppression de ce barrel.

## Responsabilités des fichiers auteur

- `game.ts` assemble contenu, actions, composants, patterns et configuration.
  Les callbacks métier encore présents doivent migrer vers les règles avant
  de clôturer le point 37 ; définir cette responsabilité ne suffit pas.
- `content.ts` déclare et normalise les catalogues, sans exécuter de commande.
  Construire une instruction d'effet statique est une déclaration de donnée.
- `rules.ts` porte les décisions particulières du jeu et appelle les capacités.
  Une orchestration réutilisable identifiée doit être examinée pour extraction.
- `effects.ts` porte les résolveurs particuliers lorsqu'ils existent, sans
  devenir un moteur d'effets parallèle.
- `state.ts` isole un état métier réellement utilisé ; `configuration.ts`
  isole un contrat de configuration ; aucun de ces fichiers n'est obligatoire.
  Le générateur crée seulement manifeste, contenu, règles, composition et test.

Les petits `state.ts` de Gérard Président, Pimp My Ride et Sac à Malices
définissent des données ou contrats propres ; leur taille seule ne motive
pas une fusion. Aucun fichier supplémentaire n'est créé par simple convention.

## Admission d'une abstraction

Un kit possède un état générique et ses invariants ; une recipe combine
des opérations sans posséder un second état ; un pattern assemble des
capacités et un déroulement de jeu. Le catalogue `mechanics-catalog.ts`
formalise ces rôles et conserve son seuil d'extraction de trois usages.

La revue devient obligatoire au deuxième **jeu réel** concerné, avec liens
vers les deux séquences et comparaison de leurs préconditions, effets,
attentes et terminaisons. Une grosse abstraction configurable nécessite
au moins trois jeux réels. Un usage futur supposé n'est pas une preuve.
Les invariants universels du runtime ont une justification distincte des
abstractions de gameplay et ne constituent pas une exception pour un futur jeu.

Le critère qualitatif d'un jeu propre est que la majorité de son code TS
décrive ses données et décisions propres : aucune gestion de transport,
persistance, moteur de choix ou seconde implémentation d'un kit. Une règle
impérative de prestige, de loyer ou de parade reste légitime. Il n'y a ni
objectif de zéro règle particulière ni obligation de convertir les jeux en DSL.

## Audit des six ensembles prioritaires

Les corps des fonctions et leurs appels ont été comparés, en incluant les
helpers extraits. Le rapport reproductible conserve les appels dans l'ordre
lexical ; il ne les présente pas comme des traces d'exécution. Les branches
et callbacks demandent une lecture métier.

| Ensemble | Séquence examinée | Décision |
| --- | --- | --- |
| Contes, `resolution.ts` et support | déplacement → case → pioche → instruction ciblée → choix/reprise | `movement.moveAndResolve`, `drawAndResolve` et le moteur d'effets portent déjà le mécanisme ; protections et tokens restent locaux |
| Panier, `rules.ts` et `market-cards.ts` | dé → déplacement → pioche différée ou quiz → éventuel échange → fin | garder les continuations propres à l'échange et la consommation du drapeau de résolution ; sélection des pions et inventaire sont génériques |
| Ça Dérape, `rules.ts` | arrivée → événement → effets ; classement → déplacement collectif ; cible → reprise | les primitives sont déjà mutualisées ; permutations de classement et boucliers sont des décisions propres |
| Sac, `rules.ts` et `economy.ts` | déplacement → achat/loyer/taxe/prison ; choix d'achat → paiement | ownership, ressources et déplacement appartiennent aux kits ; hypothèque, groupes et calcul du loyer restent propres |
| Cat Pattes, `rules.ts` et `round-rules.ts` | pioche → carte/cible autorisée → effets → défausse/fin ; score → remise en place | pioche et fin de manche utilisent les recipes ; obstacle/parade/pouvoir restent propres ; remise en place encore candidate à une revue de réutilisation |
| Olympia, `rules.ts` | choix du paquet → main → carte autorisée → prestige/effets → victoire/fin | pioche et moteur d'effets sont communs ; ordre des paquets, catégories bloquées et prestige restent locaux |

## Matrice de recherche des motifs

| Points | Occurrences comparées | Capacité existante / limite |
| --- | --- | --- |
| 88, 100 | Contes, Sac, Ça Dérape, Cat Pattes, Olympia | `drawAndResolve`, `drawEvent`, `drawForPlayer`, CardsKit ; la défausse avant/après effet diffère selon la règle |
| 89, 99 | cibles Contes, Ça Dérape, Olympia | `gameEffects.target` et résolution du moteur ; admissibilité spécifique conservée |
| 90 | prise/don Panier, carte adverse Cat Pattes, catégories Olympia | ChoiceController, inventaire/cartes ; filtres métier différents |
| 91, 101 | Contes, Panier, Ça Dérape, Sac | MovementController, DiceController et recipes ; arrivée, boucle et prison ne sont pas interchangeables |
| 92 | fin de résolution Panier, effets Contes, fin de carte Olympia | `turn.complete` / `completeTurn` ; attendre le choix et la résolution avant de terminer |
| 93 | Lama, Zig et Zag, Cat Pattes | `completeRound` ; la remise en place spécifique reste à comparer avant nouvelle extraction |
| 94, 95 | Nawak, Gérard Président, Les Absurdissimes | `submissionFlow`, vote/jugement ; les critères de révélation et de vainqueur restent propres |
| 96 | achats Sac, marché des Merveilles | ressources/ownership/économie ; ne pas remplacer un loyer immobilier par une transaction de marché générique |
| 97 | choix de jeton Lama, réponses Mnémosyne | timeout des choix et scheduler ; différence entre repli d'un choix et échéance d'une session de quiz |
| 98 | pions Panier, Contes et autres jeux de course | `sequentialPawnSelection` ; les continuations sont portées par le contrôleur de choix |

Ces recherches sont terminées, pas l'élimination universelle de toute
duplication (105). Aucune abstraction spéculative n'a été introduite.

## Mesures et restrictions restantes

`npm run game:metrics` produit `tools/game-metrics-report.json` pour les 38 jeux.
Le rapport compte contenu, composition et code particulier, tous les helpers
compris. Les catégories reposent sur les noms des fichiers ; les types sont
comptés avec le code particulier. Les lignes non vides hors commentaires `//`
ne sont pas un pourcentage sémantique de métier. Les JSON/TXT contribuent au
contenu et ne prouvent pas la qualité des règles.

La référence datée `game-metrics-reference.json` permet de détecter une hausse
d'au moins 100 lignes et 20 % de composition ou de règles, ainsi que les nouveaux
jeux. C'est un signal de revue, pas une interdiction des nouveaux besoins.
Une autre référence se passe avec `--compare`. Sa mise à jour doit accompagner
la revue des différences, pas effacer un signal sans examen.

`game:duplication` compare les fonctions normalisées (identifiants et littéraux
neutralisés), dès deux jeux, dans tous leurs fichiers TS de production, à partir
de 160 tokens. Il n'a trouvé aucun groupe au seuil fixé. Il ne détecte ni toutes
les ressemblances partielles ni l'équivalence sémantique ; la matrice ci-dessus
complète ce contrôle. Les deux outils et leurs tests font partie de `quality:check`.

`GameContextFor` masque maintenant les neuf capacités optionnelles absentes
des composants inférés dans la forme `defineGame<State>()`. Les composants des
patterns littéraux sont conservés. La forme directe et certaines fabriques de
patterns ont encore des types larges ; voting n'est pas encore déclaratif et
les callbacks généraux reçoivent toujours `GameContext`. Les points 133 et
135–140 restent donc ouverts. La façade runtime est allégée par l'extraction
des contrats de types ; les contrôleurs spécialisés conservent leur état.

`ctx.reject` délègue désormais à `rejectRule`, qui conserve code, message et
détails distincts. Les jeux ne définissent aucun `throw` propre et l'auditeur
refuse désormais cette régression. Les sources jeux/runtime ne comportent
pas de branche métier comparant le message d'une erreur ; les messages des
exceptions capturées servent aux diagnostics de validation du contenu.

Les exigences de déterminisme absolu, d'état minimal, de migrations,
de références exhaustives, de phases accessibles/terminales, d'idempotence
automatique et de suppression de tous les cycles inter-modules restent ouvertes.

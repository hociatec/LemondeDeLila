# Revue finale des mécaniques de jeu

Cette revue concerne le snapshot de `corriger.txt`, notamment les points 114,
116 et 121 à 130. L'inventaire est enregistré dans
`logs/completion-game-source-inventory.json`. Il inclut les fichiers de règles,
contenus, effets, bindings et initialisations des 39 jeux.

## Extractions réalisées

- Panier Express : suppression de tous les fichiers TypeScript de production.
  Le parcours, ses choix et la victoire sont compilés depuis `game.json`.
- Initialisations de Contes, Foulées, Morpion et Jeu de l'Oie : sélection de
  pions centralisée, avec ordre mélangé et démarrage de manche configurables.
  La Parade utilise la distribution initiale du composant cartes.
- Pioche/recyclage/défausse : `drawEvent` utilisé dans Aventure, Mon Village,
  Mission Galaxie et Contes ; `drawAndResolve` porte la séquence de Panier.
- Sélections d'adversaires : `ctx.players.others` remplace les filtres d'identité
  dans Ça Dérape, Les Mains, Dame Nature et Entre Rites.
- Classements : `ctx.ranking` porte les comparaisons et le départage ; les
  critères spécifiques restent des valeurs calculées par chaque jeu.
- Possession : suppression des vérifications dupliquées avant mutation dans
  Olympia et Gérard. Les mutations passent par Cards/Inventory/Ownership.
- Suppression des wrappers de bindings et des fonctions de statut de Ça Dérape.
  Suppression de 43 déclarations exportées sans consommateur dans les jeux,
  notamment les anciennes projections remplacées par les vues génériques.

## Responsabilités spécifiques conservées

| Groupe relu | Motif de conservation |
| --- | --- |
| Ça Dérape | Effets conditionnels de classement, miroirs, immobilité et permutations ; les positions et statuts restent détenus par les kits. |
| Sac à Malices | Prison, hypothèques, loyers, bâtiments et faillite. La disponibilité d'un achat détermine un choix ou une absence d'effet ; elle ne remplace pas les garanties d'Economy/Ownership. |
| Cat Pattes | Compatibilité obstacle/parade/pouvoir, obligation de contrer et règles de combinaison. Le cycle de manche utilise `completeRound`. |
| Corridor | Sauts, murs qui ne doivent pas fermer tous les chemins et arrivée sur le bord opposé. Ces règles de graphe ne sont pas un déplacement standard sur piste. |
| Minuit, Ballons, Galopons, Contes | Déclenchement des cases, boucliers, quiz, cadeaux et dettes de pommes. Movement réalise le déplacement ; les règles décident de l'effet d'arrivée. |
| Olympia, Entre Rites, Voyage | Prestiges, familles et collections avec leurs valeurs métier. Les transferts et classements restent génériques. |
| Contenus volumineux | Schémas et index du catalogue canonique. Les cartes portent leurs instructions ; aucun générateur parallèle ne reconstitue silencieusement un effet manquant. |

Les dix fichiers `setup-rules.ts` restants portent une différence réelle :
Corridor place les joueurs sur les bords opposés ; Dame Nature prépare ses quiz ;
Zig et Zag prépare la bataille ; Gérard et Les Absurdissimes préparent juge et
thèmes ; Pimp My Ride initialise les voitures assemblées ; Entre Rites distribue
des familles ; Les Mains distribue des professions ; Olympia répartit plusieurs
pioches ; Nawak prépare le défi et les soumissions. Les opérations élémentaires
qu'ils invoquent restent celles du moteur.

## Victoire et fin de manche

Les seuils de score ou de ressource sont des données de `thresholdVictory`,
utilisé par Taxi, Mnémosyne, Olympia, Gérard, Nawak et Les Absurdissimes. Leur
évaluation reste au moment prévu par la règle : déplacer arbitrairement une
victoire après la fin du tour modifierait les événements et pourrait distribuer
une carte supplémentaire. Les arrivées standards passent par les patterns de
course ou le programme de plateau JSON. Les ensembles de cartes, voitures,
espèces et familles sont calculés selon leur composition propre au jeu.

`completeRound` centralise score, résultat, éventuelle fin de partie, reset et
choix du prochain starter dans LAMA, Zig et Zag, Cat Pattes, Gérard, Nawak et
Les Absurdissimes. Mnémosyne clôt explicitement son quiz et son timer avant de
programmer l'inter-question ; Le Marché distingue son dernier cycle d'un nouveau
cycle avec le même starter. Ces deux orchestrations spécifiques utilisent le
contrôleur Round, sans stocker de numéro de manche parallèle.

## Frontières vérifiées

Les checks de ressources conservés déterminent une action disponible, un secours,
une dette ou une absence d'effet. Ceux de possession dans `validate`/`enumerate`
construisent les actions légales ; les mutations vérifient encore leurs propres
invariants. Les enlever du catalogue légal ferait proposer des actions impossibles.

Les pioches multiples suivies d'un choix ou d'une défausse groupée ne sont pas
assimilées à une boucle pioche/défausse immédiate : le moment du recyclage change
les cartes disponibles. Les distributions spéciales et les restrictions de
composition ne sont donc pas masquées dans une recette trop générale.

La primitive JSON de plateau ordonne les opérations d'arrivée et leurs choix.
Elle ne stocke aucun état parallèle de cartes, ressources, positions ou pions.
Un test de parcours minimal sans collection, quiz, échange, cartes ni pions
vérifie que ces capacités restent optionnelles. Les tests de parité Panier
comparent les événements métier aux traces de l'ancienne implémentation.

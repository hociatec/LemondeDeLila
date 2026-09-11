# Stockages des jeux — points 113, 114, 115, 117 et 118

La revue des types effectifs passés à `defineGame`, et de leurs lectures/écritures,
confirme la suppression des stockages parallèles de pioches, mains, positions de
piste, scores cumulés et tours sautés/supplémentaires dans les jeux installés.

Le rapport TypeScript `logs/corrections-game-state-ownership.json` couvre les 38 jeux :
32 n'ont aucun champ d'état auteur. Les six autres stockent uniquement :

- À fond les ballons : attente d'une pioche manuelle ;
- Sac à Malices : maisons, hôtels et hypothèques ;
- Gérard Président : thèmes et nom verrouillé ;
- Nawak : défi courant et historique de la manche terminée ;
- Pimp My Ride : voitures terminées et pièces les composant ;
- Zig et Zag : bataille courante et résumé de la manche terminée.

Les pioches et mains passent par le contrôleur de cartes. Les cartes de la bataille
de Zig sont retirées de la main avant d'être posées ; elles ne forment pas une
seconde main. Les positions courantes de piste passent par `ctx.movement` ; les
positions de Corridor appartiennent à sa grille. Les scores cumulés passent par
`ctx.score`. Les `pointsAwarded` historiques de Nawak décrivent une manche passée,
pas un second score courant. Les tours sautés et supplémentaires passent par
`ctx.turn` et les valeurs génériques `scheduledSkips`/`scheduledExtraTurns`.

Validation : audit sémantique des 38 types d'état, revue des écritures des règles,
260 suites / 1 152 tests réussis hors campagne, plus 152 parcours déterministes
réussis dans cette reprise. Les journaux de tests sont référencés dans
[corrections-game-composition-2026-09-09.md](corrections-game-composition-2026-09-09.md).

Cette revue ne clôture pas 112, 116 ni 120–122 : la propriété générale de tout état,
les valeurs de lancers effectifs conservées pour les effets particuliers, les
projections et les historiques doivent encore être examinés séparément.
Le stockage des catalogues a depuis été contrôlé séparément dans
[corrections-content-storage-2026-09-09.md](corrections-content-storage-2026-09-09.md).

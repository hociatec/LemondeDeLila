# Sens des dépendances des jeux — point 36

Le point 36 est clôturé : les contrats et constantes se placent sous le contenu,
le contenu sous les règles, et les règles sous la composition `game.ts`.

Les types `CerclesSacresTheme` et `BandeABananeMonkeySpecies` appartiennent
désormais à `types.ts`. Les types `SacCard` et `SacMovement` appartiennent à
`content-types.ts`. Leurs anciens modules les réexportent pour leurs consommateurs,
sans dépendance inverse des contrats vers les chargeurs de contenu.

`inspectGameLayers` parcourt les imports de types, imports statiques, imports
dynamiques littéraux, `require` et réexports. Il traverse les fichiers auxiliaires
pour détecter aussi `content -> bridge -> rules`. Le contrôle des cycles existant
reste actif. Les deux vérifications sont obligatoires dans `quality:check`.

Validation :

- 21 tests de l'auditeur, dont six graphes interdits et un graphe autorisé ;
  `logs/corrections-layer-tests.log`.
- Audit des 38 jeux : zéro violation, sans baseline ni exception ajoutée.
- `typecheck` et `quality:check` réussis :
  `logs/corrections-reference-typecheck.log` et `logs/corrections-reference-quality.log`.

Cette clôture ne clôture pas le point 37 : plusieurs `game.ts` contiennent encore
des fonctions métier inline à extraire. Elle ne clôture pas non plus le point 39
ni l'élimination de toutes les duplications de mécanismes.

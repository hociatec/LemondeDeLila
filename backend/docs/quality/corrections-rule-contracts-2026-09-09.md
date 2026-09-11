# Rôle des fichiers de règles

Le point 39 est clôturé. Le contrat auteur précise les responsabilités des règles,
du contenu, des types et de la composition dans `architecture/game-authoring-files.md`.
Les quatre contrats encore exportés par `rules.ts` ont été déplacés vers `types.ts`
ou `state.ts` : état des Ballons, choix de Rites, déplacement d'Odyssée et effet ciblé
de Voyage. Leurs consommateurs importent directement ces contrats.

L'auditeur AST refuse les déclarations publiques de types/interfaces et les
réexports explicitement typés dans `rules.ts`. Il accepte les alias de contexte
privés et les recettes SDK configurées. Ce contrôle ne démontre pas l'absence
globale de mécanique dupliquée : le point 105 reste ouvert.

Validation : 27 tests des audits/générateurs, audit sans violation, typage et lint
des 15 fichiers modifiés réussis ; quatre suites de jeux, neuf tests réussis.
Les corps des règles n'ont pas changé. Journaux `logs/corrections-rule-contract-*`.

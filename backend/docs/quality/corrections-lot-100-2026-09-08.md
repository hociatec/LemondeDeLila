# Lot des 100 premières exigences restantes

53 exigences achevées ou dont la conformité est vérifiée ; 47 conservées ouvertes.
Les 100 exigences du lot sont recensées ci-dessous, sans modifier leur numéro.
La clôture d'un point demandant un audit signifie que cet audit est réalisé,
pas que toutes les corrections qui en découlent sont achevées.

Preuves, décisions par mécanique, limites des mesures et des types :
[revue des jeux et du SDK](../architecture/game-authoring-review-2026-09-08.md).

Les points ouverts comprennent notamment le protocole de contenu unique,
les références métier encore textuelles, la composition pure de `game.ts`,
les contrats auteur encore liés au runtime, l'état minimal et les migrations,
les capacités encore trop larges, les phases et les garanties d'idempotence,
ainsi que les cycles entre modules. Ils restent dans `a corriger..txt`.

Validation : 191 suites Jest, 702 tests réussis ; typage, lint, build,
chargement de l'AppModule et `quality:check`. Aucun seuil existant ni budget
de dette n'a été augmenté.

| Point | Exigence | Statut |
| --- | --- | --- |
| 6 | Centraliser la recherche des fichiers de contenu. | Clos |
| 8 | Centraliser `readFileSync`/lecture asynchrone du contenu. | Clos |
| 14 | Faire de `defineGameContent()` le point d'entrée auteur unique. | Ouvert |
| 15 | Éliminer les différents styles actuels de chargement (`freezeGameContent`, loaders locaux, lectures directes, etc.) au profit d'un protocole unique. | Ouvert |
| 16 | Versionner explicitement le format de chaque contenu statique. | Clos |
| 25 | Séparer texte UX et données exécutables. | Ouvert |
| 27 | Faire du texte un attribut purement présentatif. | Ouvert |
| 29 | Faire valider toutes les références d'effets lors de la compilation du contenu. | Ouvert |
| 30 | Faire valider toutes les références aux cartes, cases, tracks, ressources et composants avant démarrage d'une partie. | Ouvert |
| 36 | Faire tendre la dépendance d'un jeu vers `types/constants -> content -> rules -> game composition`. | Ouvert |
| 37 | Définir précisément le rôle de `game.ts`. | Ouvert |
| 38 | Définir précisément le rôle de `content.ts`. | Clos |
| 39 | Définir précisément le rôle de `rules.ts`. | Ouvert |
| 40 | Définir précisément le rôle de `effects.ts`. | Clos |
| 41 | Ne pas créer de fichiers `state.ts`, `configuration.ts`, `effects.ts` par convention s'ils n'apportent aucune responsabilité propre. | Clos |
| 58 | Garantir que rejouer les mêmes commandes avec le même seed produit exactement le même état. | Ouvert |
| 63 | Éviter d'exposer au SDK auteur des structures comme `EffectEngineState`, `GameSchedulerState`, etc. lorsqu'elles ne sont que des détails runtime. | Ouvert |
| 64 | Rendre les contracts auteur moins dépendants de l'organisation interne des kits. | Ouvert |
| 65 | Stabiliser les types SDK comme API durable. | Ouvert |
| 68 | Réduire progressivement l'énorme `runtime/public-api.ts`. | Clos |
| 69 | Ne pas transformer `runtime/public-api` en barrel exportant tout le moteur. | Clos |
| 70 | Identifier explicitement les exports publics, semi-publics et internes. | Clos |
| 71 | Créer une convention de visibilité logique : `sdk`, `internal`, éventuellement `testing`. | Clos |
| 74 | Conserver les kits comme primitives mécaniques génériques. | Clos |
| 75 | Conserver les recipes comme compositions génériques de faible niveau. | Clos |
| 76 | Conserver les patterns comme mécaniques structurantes de haut niveau. | Clos |
| 77 | Formaliser le critère d'extraction d'une nouvelle abstraction : au moins deux jeux réels doivent bénéficier de l'abstraction. | Clos |
| 78 | Idéalement exiger trois usages lorsque l'abstraction est importante ou très configurable. | Clos |
| 79 | Ne jamais généraliser uniquement parce qu'un futur jeu pourrait éventuellement réutiliser quelque chose. | Clos |
| 80 | Auditer les plus gros `rules.ts` pour détecter les mécaniques répétées. | Clos |
| 81 | Commencer par `contes-et-cacahuetes/resolution.ts`. | Clos |
| 82 | Puis `panier-express/rules.ts`. | Clos |
| 83 | Puis `ca-derape/rules.ts`. | Clos |
| 84 | Puis `sac-a-malices/rules.ts`. | Clos |
| 85 | Puis `cat-pattes/rules.ts`. | Clos |
| 86 | Puis `olympia/rules.ts`. | Clos |
| 87 | Comparer les séquences d'actions, pas seulement les noms de fonctions. | Clos |
| 88 | Chercher les motifs répétés : draw -> choose -> resolve -> discard. | Clos |
| 89 | Chercher les motifs répétés de sélection de joueur. | Clos |
| 90 | Chercher les motifs répétés de sélection de cartes. | Clos |
| 91 | Chercher les motifs répétés de course sur track. | Clos |
| 92 | Chercher les motifs répétés de fin de tour. | Clos |
| 93 | Chercher les motifs répétés de fin de manche. | Clos |
| 94 | Chercher les motifs répétés d'attente de tous les joueurs. | Clos |
| 95 | Chercher les motifs répétés de vote/jugement. | Clos |
| 96 | Chercher les motifs répétés de ressource + paiement + validation. | Clos |
| 97 | Chercher les motifs répétés de choix avec timeout/fallback. | Clos |
| 98 | Chercher les motifs répétés de choix séquentiel. | Clos |
| 99 | Chercher les motifs répétés de résolution de cible. | Clos |
| 100 | Chercher les motifs répétés de pioche/défausse/main. | Clos |
| 101 | Chercher les motifs répétés de déplacement/pion/dés. | Clos |
| 102 | Remonter uniquement ces motifs réellement réutilisés dans recipe/pattern/kit. | Clos |
| 103 | Ne pas transformer toutes les règles en DSL. | Clos |
| 104 | Ne pas viser zéro ligne de règles spécifiques dans les jeux. | Clos |
| 105 | Viser zéro ligne de mécanique réutilisable dupliquée dans les jeux. | Ouvert |
| 106 | Définir un seuil qualitatif pour un jeu « propre » : la majorité de son code TS doit décrire ce jeu, pas le framework. | Clos |
| 107 | Suivre métriquement `content LOC / declarative LOC / custom rules LOC`. | Clos |
| 108 | Suivre les jeux qui grossissent anormalement d'une version à l'autre. | Clos |
| 109 | Déclencher une revue moteur lorsqu'un deuxième jeu copie une même mécanique. | Clos |
| 110 | Ne pas utiliser uniquement LOC comme indicateur de dette. | Clos |
| 111 | Détecter la duplication structurelle en plus de la duplication textuelle. | Clos |
| 112 | Maintenir l'ownership de l'état au niveau du composant générique. | Ouvert |
| 113 | Si `cards.deck` existe, ne pas conserver parallèlement un deck artisanal dans le state du jeu. | Ouvert |
| 114 | Même règle pour hands. | Ouvert |
| 115 | Même règle pour movement positions. | Ouvert |
| 116 | Même règle pour dice. | Ouvert |
| 117 | Même règle pour scores. | Ouvert |
| 118 | Même règle pour skip/extra turns. | Ouvert |
| 119 | Étendre `STATE_OWNERSHIP_FIELDS` lorsque de nouveaux kits génériques apparaissent. | Ouvert |
| 120 | S'assurer qu'une donnée possède un seul source of truth. | Ouvert |
| 121 | Supprimer les projections stockées dans l'état lorsqu'elles peuvent être calculées. | Ouvert |
| 122 | Ne persister que ce qui est nécessaire à reconstruire exactement la partie. | Ouvert |
| 123 | Ne pas persister le contenu statique complet dans chaque partie. | Ouvert |
| 129 | Versionner les extensions spécifiques si elles sont persistées ou envoyées à des clients. | Ouvert |
| 130 | Centraliser les migrations de state de jeu si une évolution incompatible devient nécessaire. | Ouvert |
| 131 | Empêcher qu'un jeu lise directement la structure interne du state d'un kit. | Ouvert |
| 132 | Préférer les capabilities du contexte (`ctx.cards`, etc.). | Clos |
| 133 | Mais réduire le caractère « service locator universel » de `GameContext`. | Ouvert |
| 134 | Structurer `GameContext` en sous-capacités cohérentes. | Clos |
| 135 | Éviter que chaque règle voie systématiquement toutes les fonctions du moteur. | Ouvert |
| 136 | Faire fonctionner réellement `GameContextFor<typeof game>` comme restriction de capacités. | Ouvert |
| 137 | Une définition qui n'utilise pas de cartes ne devrait idéalement pas exposer `ctx.cards`. | Ouvert |
| 138 | Une définition qui n'utilise pas de movement ne devrait pas exposer `ctx.movement`. | Ouvert |
| 139 | Une définition qui n'utilise pas de voting ne devrait pas exposer `ctx.voting`. | Ouvert |
| 140 | Faire dériver le contexte disponible des composants/patterns compilés. | Ouvert |
| 141 | Réduire `game-rule-context.ts` ou le transformer en composition de façades spécialisées. | Clos |
| 142 | Maintenir une seule méthode canonique de rejet métier (`rejectRule`, etc.). | Clos |
| 143 | Ne pas laisser chaque jeu inventer sa représentation d'erreur. | Clos |
| 146 | Éviter que les messages d'erreur soient utilisés comme conditions métier. | Clos |
| 150 | Éliminer les chemins secondaires qui permettent de contourner validation/permissions. | Ouvert |
| 151 | Normaliser les identifiers de composants. | Ouvert |
| 154 | Valider les références de composants à compilation. | Ouvert |
| 156 | Garantir qu'une phase est atteignable. | Ouvert |
| 158 | Détecter les phases sans sortie lorsqu'elles ne sont pas explicitement terminales. | Ouvert |
| 159 | Définir explicitement les phases terminales. | Ouvert |
| 161 | Garantir leur idempotence conceptuelle, pas uniquement l'unicité des IDs. | Ouvert |
| 162 | Éviter les automatic rules dont l'exécution répétée modifie continuellement l'état. | Ouvert |
| 164 | Centraliser les transitions de lifecycle. | Ouvert |
| 170 | Supprimer les dépendances circulaires entre bounded contexts. | Ouvert |
| 171 | Commencer par le SCC `bot ↔ vault ↔ room ↔ presence`. | Ouvert |

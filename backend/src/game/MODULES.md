# Architecture du moteur de jeu

La frontière `game` contient quatre responsabilités distinctes :

- `core` orchestre les commandes, la persistance et les ports applicatifs ;
- `engine/runtime` exécute le modèle déclaratif déterministe ; `engine/sdk`
  expose sa surface auteur, et `engine/application` les capacités de catalogue ;
- `composition` ne contient que la découverte, le registre et le wiring Nest ;
- `games` contient les définitions et règles propres aux jeux.

Le runtime se trouve dans `engine/runtime` : il s'agit de l'implémentation
du noyau, tandis que `engine/sdk/public-api.ts` constitue sa façade auteur. Le
dossier `core` n'est pas un second moteur de règles. La sémantique canonique
est définie dans [ADR-006](../../docs/architecture/adr-006-game-sdk-runtime.md).

Les jeux du catalogue sont exclusivement déclarés en JSON : `game.json`,
`manifest.json`, `rules.md` et les ressources de contenu. Le compilateur produit
la même définition exécutable que le SDK TypeScript. Aucun `game.ts` ou `rules.ts`
supplémentaire n'est autorisé dans le catalogue de production.

Les dépendances suivent :

```text
games -> engine/sdk/public-api -> engine/runtime
composition -> core + engine + games
```

Les tests d'architecture interdisent NestJS, la persistance, les imports profonds
du runtime et les sources exécutables dans `games`. Le SDK TypeScript reste
autorisé pour les primitives, les extensions revues et les tests de parité ; il
ne constitue pas une seconde voie de publication des jeux du catalogue.

Les capacités génériques sont classées par sous-domaine dans `runtime/` :
`actions`, `automation`, `cards`, `choices`, `configuration`, `content`,
`definitions`, `effects`, `events`, `kits`, `lifecycle`, `patterns`,
`projection`, `recipes`, `state` et `submissions`. Un kit tenant dans un fichier
reste sous `kits`; un domaine possédant plusieurs responsabilités obtient son
propre dossier.

## Contrat stable

- `defineGame()` compile patterns, composants, actions et hooks une seule fois ;
- une partie consomme uniquement la définition compilée ;
- le contenu statique est versionné et l'état persistant ne conserve que les
  références et valeurs runtime ;
- la vue publique générique est versionnée et les extensions restent sous
  `game` ;
- toute entrée Action, Choice ou Effect traverse le même parseur typé ;
- une abstraction générique nouvelle doit améliorer plusieurs jeux existants.

La dernière règle est contrôlée par `engine-effect-pack-governance.cjs` : une
réutilisation nécessite plusieurs jeux mécaniquement différents ou une preuve
explicite d'indépendance. Une copie renommée ne suffit pas. Les scopes et la
procédure de promotion sont définis par [ADR-008](../../docs/architecture/adr-008-effect-pack-reuse-evidence.md).

## Ajout d'une mécanique

Un nouveau jeu est d'abord composé avec `components`, `actions`, `effects`,
conditions, phases, patterns et recipes existants. Un nouveau pack est une
exception : le générateur du registre exige une ADR, la liste des mécanismes
essayés, leur insuffisance concrète et un test exécutable. Modifier uniquement
le plafond du nombre de packs ne contourne pas ce contrôle.

Le moteur contient les mécanismes qui ne dépendent pas des règles particulières
d'un jeu : validation, séquencement, état des composants, hasard déterministe,
exécution des effets et projection. Une composition métier du catalogue appartient
à `rules`, avec sa classification explicite ; elle ne devient pas du runtime
simplement parce que sa configuration est externalisée en JSON.

Les décisions globales de couches, vocabulaire, présentation et wiring Nest
sont définies dans `docs/architecture/module-conventions.md` et ADR-003.

Le [guide auteur et sa Definition of Done](../../docs/architecture/authoring-and-boundaries.md)
décrit l'ownership de l'état, l'ajout d'un kit et le choix recipe/pattern/rule.

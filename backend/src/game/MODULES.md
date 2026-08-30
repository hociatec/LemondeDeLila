# Architecture du moteur de jeu

La frontière `game` contient quatre responsabilités distinctes :

- `core` implémente le moteur déterministe, ses ports applicatifs et ses adapters ;
- `engine` expose les capacités de catalogue et le SDK stable ;
- `composition` ne contient que la découverte, le registre et le wiring Nest ;
- `games` contient les définitions et règles propres aux jeux.

Le runtime se trouve dans `engine/runtime` : il s'agit de l'implémentation
du noyau, tandis que `engine/sdk/public-api.ts` constitue sa façade auteur. Le
dossier `engine` n'est donc pas une seconde implémentation du runtime. Le
déplacer sous `engine` mélangerait API publique, catalogue applicatif et détails
d'exécution sans améliorer la direction des dépendances.

Les jeux suivent exclusivement :

```text
games -> engine/sdk/public-api -> core
composition -> core + engine + games
```

Les tests d'architecture interdisent NestJS, la persistence, les imports
profonds du runtime et les anciens formats dans `games`. Un jeu standard expose
`game.ts`, `rules.ts`, `content.ts`, `game.spec.ts` et `manifest.json`. Des
fichiers supplémentaires (`state.ts`, `effects.ts`, `configuration.ts`) ne sont
créés que lorsqu'une responsabilité métier réelle le nécessite.

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

Les décisions globales de couches, vocabulaire, présentation et wiring Nest
sont définies dans `docs/architecture/module-conventions.md` et ADR-003.

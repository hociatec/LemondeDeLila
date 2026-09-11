# Contrat de compilation des jeux — déclarations SDK 6.0.0

Le moteur sépare trois étapes :

1. `AuthorGameDefinition` décrit les règles et leur composition en patterns.
2. `defineGame` valide et compose une seule fois les règles. Il produit un
   `CompiledGameDefinition`, marqué comme compilé et gelé, distinct de l'entrée.
3. `DeclarativeGameRuntime` accepte cet artefact compilé ; il n'importe pas les
   contrats d'authoring, le compilateur ou les définitions de patterns.

`contracts/game-rule-program.ts` porte les contrats de règles exécutables
communs. `contracts/compiled-game-definition.ts` porte le contrat d'exécution.
`definitions/game-definition-contracts.ts` porte la composition d'authoring.
Un garde de dépendances couvre aussi les imports de types.

## Représentation intermédiaire

`CompiledGamePlan` est le catalogue intermédiaire neutre : version de format,
patterns descriptifs, capacités activées, identifiants de composants, actions,
phases, choix et effets. Son module n'importe aucun builder, pattern, recipe
ou exécuteur. Le compilateur l'assemble une seule fois et le runtime l'utilise
pour sa description publique. Le plan est gelé et sérialisable en JSON.

Les patterns conservés dans l'artefact ne contiennent plus que `id` et
`mechanics`. Leurs hooks, actions et initialisations ont été fusionnés dans
le programme d'exécution. Les callbacks des jeux TypeScript restent dans ce
programme : le plan neutre n'est pas une sérialisation de code JavaScript.

## Capacités et migration du typage

`GameContextFor<typeof definition>` utilise le catalogue compilé. Les
composants activent Cards, Movement, Pawns, Dice, Inventory, Economy,
Ownership, Grid et Quiz. Les mécaniques des patterns activent les interactions
correspondantes. Une déclaration explicite permet d'activer Scheduler,
Submissions, SubmissionFlow, Judge ou Voting lorsqu'aucun pattern ne le fait :

```ts
const definition = defineGame<State>()({
  // Métadonnées et actions habituelles…
  capabilities: ['scheduler'],
});
```

Déclarer une capacité de composant sans installer ce composant échoue à la
compilation. La forme directe `defineGame({...})` conserve désormais les mêmes
littéraux que la forme curryfiée. Les ressources apportées par les patterns
restent typées après suppression des structures d'authoring.

Les primitives communes (joueurs, horloge, score, cycle de partie et effets)
restent disponibles. Cette restriction concerne le contrat `GameContextFor` ;
les contrôleurs internes du moteur restent responsables de l'exécution.

Les consommateurs d'un artefact compilé doivent utiliser ses règles fusionnées
ou son `plan`, et ne plus lire des hooks ou composants dans `patterns`.
Cette évolution incompatible du type inféré est versionnée en **6.0.0** dans
le contrat de déclarations du SDK. Les noms exportés restent identiques.
Les versions des snapshots et des contenus existants ne sont pas modifiées
par cette évolution des déclarations TypeScript.

## Jeu standard JSON

`games/vents-sacres/course-des-etoiles` est un jeu d'initiation installé,
entièrement décrit par `manifest.json`, `game.json` et `rules.md`. Le registre
généré le compile via le même pipeline que les autres jeux. Le scénario testé
va de l'initialisation à la victoire, avec déplacement, ressources et tours.

Le compilateur valide le manifeste, le schéma fermé du document et les
références statiques avant de créer le runtime. Le profil JSON v1 prend en
charge les composants cartes, mains, piste et dés, le setup, les phases,
les actions sans saisie, les effets structurés et les victoires par seuil.
Il ne prétend pas couvrir toutes les règles des jeux TypeScript existants.
Le point 19 conserve le suivi de l'extension du schéma.

L'audit des packages accepte ce profil sans fichiers TypeScript et interdit
de lui ajouter une logique TypeScript parallèle.

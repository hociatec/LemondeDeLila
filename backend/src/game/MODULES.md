# Modules transversaux du gameplay

Chaque capacité générique du moteur possède son propre dossier. La structure cible est la même pour tous les modules :

- `domain` : règles et modèles indépendants des frameworks ;
- `application` : cas d'usage et services ;
- `infrastructure` : composition Nest, persistance et adaptateurs ;
- `presentation` : construction des contrats exposés aux clients.

Un sous-dossier n'est créé que lorsqu'il contient une responsabilité réelle. Les jeux de `game/games` consomment ces modules, mais conservent leurs règles spécifiques.

Les modules sont placés directement sous `game`. `game/core` contient uniquement le noyau transversal encore partagé par plusieurs capacités ; il respecte lui aussi les couches `application`, `domain` et `infrastructure`. Les fichiers de composition Nest globaux restent directement à la racine de `game`.

Modules déjà migrés :

- `action-resolver` ;
- `actionlog` ;
- `board-effects-policies` ;
- `cards` ;
- `deck-policies` ;
- `dice` ;
- `effects` ;
- `exchange` ;
- `grid` ;
- `history` ;
- `movement` ;
- `pawn-selection` ;
- `prompts` ;
- `quiz` ;
- `shortcuts` ;
- `state` ;
- `victory`.

Ils servent de structure de référence pour les prochains déplacements.

## Écrire un jeu déclaratif

Le chemin cible est court : un jeu importe uniquement
`game/core/application/public-api`, déclare son contenu, choisit un pattern ou
des kits, puis conserve localement les règles réellement spécifiques.

### Exemple minimal

```ts
import {
  defineGame,
  gridGame,
  defineAction,
  gameInput,
} from '../../core/application/public-api';

const actions = {
  play: defineAction({
    input: gameInput.object({
      cell: gameInput.string(),
    }),
    execute: ({ actor, input, ctx }) => {
      ctx.grid.set('board', input.cell, actor.id);
      ctx.turn.complete();
    },
  }),
};

export default defineGame({
  id: 'mini-grid',
  displayName: 'Mini grille',
  category: 'Exemples',
  players: { min: 2, max: 2 },
  patterns: [gridGame({ boardId: 'board', width: 3, height: 3, winLength: 3 })],
  setup: () => ({}),
  actions,
});
```

Sans `view()`, le runtime expose automatiquement une projection générique
versionnée : `extras.system`, `extras.kits`, `extras.actionCatalog`,
`actions`, `pending`, `submissions` et `timers`. Une `view()` custom ne doit
ajouter que la projection métier impossible à dériver des kits.

### Exemple complexe

Pour un jeu de cartes à effets, le socle reste identique :

```ts
import {
  cardGame,
  defineEffect,
  defineGame,
  gameEffects,
  gameInput,
} from '../../core/application/public-api';

const steal = defineEffect({
  input: gameInput.object({
    count: gameInput.number({ integer: true, min: 1 }),
  }),
  apply: ({ actorPlayerId, targetPlayerIds, data, ctx }) => {
    if (actorPlayerId == null) return;
    for (const target of targetPlayerIds) {
      for (let index = 0; index < data.count; index += 1) {
        ctx.cards.stealRandom('players', target, actorPlayerId);
      }
    }
  },
});

export default defineGame({
  id: 'cards-with-effects',
  displayName: 'Cartes à effets',
  category: 'Exemples',
  players: { min: 2, max: 4 },
  patterns: [cardGame({ deckId: 'events', handId: 'players', cards: [] })],
  setup: () => ({}),
  actions: {},
  effects: {
    steal,
  },
});
```

Les primitives universelles restent dans `gameEffects`. Une mécanique propre à
un jeu passe par `defineEffect` ou par une recipe locale. Une extraction vers le
core n’est candidate qu’après plusieurs implémentations comparables.

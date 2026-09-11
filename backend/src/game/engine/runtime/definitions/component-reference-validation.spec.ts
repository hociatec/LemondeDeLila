import { defineAction } from './game-definition-builders';
import { defineGame } from './game-definition';
import { gameInput } from '../actions/game-input-schema';
import { defineGameContent } from '../content/game-content';
import { cards } from '../cards/cards-kit';
import { movement } from '../kits/movement-kit';
import { collection } from '../projection/collection-view';
import { economy } from '../kits/economy-kit';
import { inventory } from '../kits/inventory-kit';
import type { GameEffectInstruction } from '../contracts/effect-ir';
import { defineEffect, gameEffects } from '../effects/effects-kit';
import type {
  GameComponentDefinition,
  GameInitialization,
} from './component-kit';

const base = {
  id: 'component-references',
  displayName: 'References',
  category: 'test',
  players: { min: 1, max: 2 },
  actions: {
    wait: defineAction({ input: gameInput.object({}), execute: () => {} }),
  },
};

it('validates custom effect data at compilation without running its resolver', () => {
  const apply = jest.fn();
  const effect = defineEffect({
    input: gameInput.object({
      count: gameInput.number({ integer: true, min: 1 }),
    }),
    apply,
  });
  const compileData = (data: unknown) =>
    defineGame<object>()({
      ...base,
      effects: { award: effect },
      content: defineGameContent(base.id, {
        cards: [
          {
            id: 'card',
            effects: [{ kind: 'custom', effectId: 'award', data }],
          },
        ],
      }),
    });
  expect(() => compileData({ count: 0 })).toThrow(/count/);
  expect(() => compileData({ count: 2 })).not.toThrow();
  expect(apply).not.toHaveBeenCalled();
});

function compile(
  effects: readonly GameEffectInstruction[] = [],
  components: readonly GameComponentDefinition[] = [],
  initialization?: GameInitialization,
) {
  return defineGame<object>()({
    ...base,
    resourceIds: ['coins'],
    initialization,
    components: [
      cards.deck({ id: 'deck', cards: ['one', 'two'] }),
      cards.deck({ id: 'other', cards: ['three'] }),
      cards.hands({
        id: 'hand',
        deck: 'deck',
        initial: 0,
        visibility: 'owner',
      }),
      movement.track({ id: 'board', spaces: 5 }),
      ...components,
    ],
    content: defineGameContent(base.id, {
      uninstalledCards: [{ id: 'unused', effects }],
    }),
  });
}

it.each<GameEffectInstruction>([
  {
    kind: 'give-card',
    handId: 'hand',
    cardId: 'absent',
    from: { kind: 'self' },
    to: { kind: 'next' },
  },
  {
    kind: 'give-card',
    handId: 'hand',
    cardId: 'three',
    from: { kind: 'self' },
    to: { kind: 'next' },
  },
  { kind: 'draw-cards', handId: 'hand', deckId: 'other', count: 1 },
  { kind: 'discard-random', handId: 'hand', deckId: 'other', count: 1 },
  { kind: 'move-to', trackId: 'board', position: 5 },
  { kind: 'move-to', trackId: 'board', position: -1 },
  { kind: 'move-to', trackId: 'board', position: 0.5 },
  { kind: 'gain-resource', resource: 'coin-typo', amount: 1 },
  { kind: 'lose-resource', resource: 'coin-typo', amount: 1 },
  {
    kind: 'transfer-resource',
    resource: 'coin-typo',
    amount: 1,
    from: { kind: 'self' },
    to: { kind: 'next' },
  },
  gameEffects.when(gameEffects.condition.hasCard('hand', 'three'), []),
  gameEffects.when(gameEffects.condition.atPosition('board', 5), []),
  gameEffects.when(gameEffects.condition.hasResource('coin-typo', 1), []),
  gameEffects.when(
    { kind: 'track-position', trackId: 'board', min: 3, max: 2 },
    [],
  ),
])('rejects invalid references in uninstalled content: %j', (effect) => {
  expect(() => compile([effect])).toThrow(
    /Définition component-references.content/,
  );
});

it('checks nested conditional and reaction branches before setup', () => {
  const invalid = gameEffects.gainResource('coin-typo', 1);
  expect(() =>
    compile([
      gameEffects.when(
        gameEffects.condition.hasResource('coins', 1),
        [],
        [invalid],
      ),
    ]),
  ).toThrow(/coin-typo/);
  expect(() =>
    compile([
      {
        kind: 'reaction',
        reactor: { kind: 'self' },
        options: ['yes'],
        reactions: { yes: [invalid] },
      },
    ]),
  ).toThrow(/coin-typo/);
});

it('accepts valid references and leaves resource declarations out of initialization', () => {
  const definition = compile([
    {
      kind: 'give-card',
      handId: 'hand',
      cardId: 'one',
      from: { kind: 'self' },
      to: { kind: 'next' },
    },
    { kind: 'draw-cards', handId: 'hand', deckId: 'deck', count: 1 },
    gameEffects.gainResource('coins', 1),
    gameEffects.when(gameEffects.condition.atPosition('board', 4), []),
  ]);
  expect(definition.initialization).toBeUndefined();
  expect(Object.isFrozen(definition.resourceIds)).toBe(true);
});

it.each([5, -1, 0.5, Infinity])(
  'rejects invalid initial track position %s',
  (position) => {
    for (const initial of [position, { '1': position }])
      expect(() => compile([], [], { tracks: { board: initial } })).toThrow(
        /initialization\.tracks\.board/,
      );
  },
);

it('checks card sets even when their deck has no identifiable cards', () => {
  expect(() =>
    compile(
      [],
      [
        cards.deck({ id: 'empty', cards: [] }),
        cards.hands({
          id: 'empty-hand',
          deck: 'empty',
          initial: 0,
          visibility: 'owner',
        }),
        cards.sets({
          id: 'families',
          deck: 'empty',
          hand: 'empty-hand',
          sets: { family: ['absent'] },
        }),
      ],
    ),
  ).toThrow(/carte absente/);
});

it('validates collection and market resource references', () => {
  expect(() =>
    compile(
      [],
      [
        collection.view({
          id: 'view',
          groups: { wealth: { kind: 'resource', id: 'absent' } },
        }),
      ],
    ),
  ).toThrow(/absent/);
  expect(() =>
    compile(
      [],
      [
        collection.view({
          id: 'view',
          groups: {},
          total: { kind: 'resource', id: 'absent' },
        }),
      ],
    ),
  ).toThrow(/absent/);
  expect(() =>
    compile(
      [],
      [
        inventory.set({ id: 'stock', items: ['apple'], visibility: 'public' }),
        economy.market({
          id: 'shop',
          inventory: 'stock',
          currency: 'absent',
          prices: { apple: 1 },
        }),
      ],
    ),
  ).toThrow(/currency/);
  expect(() =>
    compile(
      [],
      [
        collection.view({
          id: 'view',
          groups: { wealth: { kind: 'resource', id: 'initialized' } },
        }),
      ],
      { resources: { initialized: 0 } },
    ),
  ).not.toThrow();
});

it('validates raw track definitions and their landing references', () => {
  for (const extra of [
    { finish: 5 },
    { homeStretch: { from: -1 } },
    { landingEffects: { 5: [] } },
  ])
    expect(() =>
      compile(
        [],
        [{ component: 'movement.track', id: 'raw', spaces: 5, ...extra }],
      ),
    ).toThrow(/case inexistante/);
});

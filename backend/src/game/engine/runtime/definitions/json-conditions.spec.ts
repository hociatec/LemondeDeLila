import { compileJsonGame } from './json-game-compiler';
import { DeclarativeGameRuntime } from '../declarative-game.runtime';
import type { EffectCondition } from '../contracts/effect-ir';
import type { DeclarativeState } from '../state/declarative-state';
import {
  FixedGameClock,
  StateGameRng,
} from '../../../core/application/models/game-execution-context.model';
import manifest from '../../../testing/fixtures/json-course/manifest.json';
import document from '../../../testing/fixtures/json-course/game.json';

function definition(condition: unknown) {
  return compileJsonGame(manifest, {
    ...document,
    components: [
      { component: 'inventory.set', id: 'bag', items: ['apple', 'pear'] },
      { component: 'ownership.registry', id: 'land', assets: ['house'] },
      {
        component: 'cards.deck',
        id: 'deck',
        cards: [{ id: 'token' }, { id: 'other' }],
        shuffle: false,
      },
      {
        component: 'cards.hands',
        id: 'hand',
        deck: 'deck',
        initial: 1,
        visibility: 'owner',
      },
    ],
    setup: { firstPlayer: 'first', scores: -2, resources: { stars: 0 } },
    actions: {
      advance: {
        effects: [
          {
            kind: 'conditional',
            condition,
            then: [{ kind: 'gain-resource', resource: 'stars', amount: 1 }],
          },
        ],
      },
    },
  });
}

it.each<[EffectCondition, boolean]>([
  [{ kind: 'score', compare: 'eq', amount: -2 }, true],
  [{ kind: 'score', compare: 'ne', amount: -2 }, false],
  [{ kind: 'score', compare: 'lt', amount: -1 }, true],
  [{ kind: 'score', compare: 'lte', amount: -2 }, true],
  [{ kind: 'score', compare: 'gt', amount: -3 }, true],
  [{ kind: 'score', compare: 'gte', amount: -1 }, false],
  [{ kind: 'resource', resource: 'stars', compare: 'eq', amount: 0 }, true],
  [{ kind: 'has-card', handId: 'hand', cardId: 'token' }, true],
  [{ kind: 'has-card', handId: 'hand', cardId: 'other' }, false],
  [
    { kind: 'inventory-count', inventoryId: 'bag', compare: 'eq', amount: 3 },
    true,
  ],
  [
    {
      kind: 'inventory-count',
      inventoryId: 'bag',
      itemId: 'apple',
      compare: 'eq',
      amount: 2,
    },
    true,
  ],
  [
    {
      kind: 'inventory-count',
      inventoryId: 'bag',
      itemId: 'pear',
      compare: 'gt',
      amount: 1,
    },
    false,
  ],
  [{ kind: 'owns-asset', registryId: 'land', assetId: 'house' }, true],
  [
    {
      kind: 'owns-asset',
      registryId: 'land',
      assetId: 'house',
      target: { kind: 'next' },
    },
    false,
  ],
  [
    { kind: 'not', condition: { kind: 'score', compare: 'gt', amount: 0 } },
    true,
  ],
  [
    {
      kind: 'all',
      conditions: [
        { kind: 'score', compare: 'eq', amount: -2 },
        { kind: 'owns-asset', registryId: 'land', assetId: 'house' },
      ],
    },
    true,
  ],
  [
    {
      kind: 'any',
      conditions: [
        { kind: 'score', compare: 'eq', amount: 0 },
        {
          kind: 'inventory-count',
          inventoryId: 'bag',
          compare: 'eq',
          amount: 0,
        },
      ],
    },
    false,
  ],
])(
  'executes a JSON condition %j from a restored state',
  (condition, expected) => {
    const runtime = new DeclarativeGameRuntime(definition(condition));
    const state = runtime.hydrateInitialState({
      version: 1,
      status: 'started',
      log: [],
      phase: 'setup',
      players: [
        { id: 1, username: 'One' },
        { id: 2, username: 'Two' },
      ],
      metadata: { rng: { seed: 42, counter: 0 } },
    }) as DeclarativeState<Record<string, never>>;
    state.engine.kits.inventory!.byPlayer.bag['1'] = ['apple', 'apple', 'pear'];
    state.engine.kits.ownership!.owners.land.house = [1];
    const restored: typeof state = JSON.parse(JSON.stringify(state));
    const result = runtime.applyActions(
      restored,
      [runtime.validateAction(restored, { type: 'advance', payload: {} }, 1)],
      {
        actorId: 1,
        clock: new FixedGameClock(1000),
        rng: new StateGameRng(restored),
      },
    );
    expect(result).toHaveProperty(
      'engine.playerValues.resources.stars.1',
      expected ? 1 : 0,
    );
    expect(restored.engine.kits.inventory!.byPlayer.bag['1']).toEqual([
      'apple',
      'apple',
      'pear',
    ]);
  },
);

it.each([
  { kind: 'resource', resource: 'missing', compare: 'eq', amount: 0 },
  { kind: 'score', compare: 'evaluate', amount: 0 },
  { kind: 'score', compare: 'eq', amount: '0' },
  { kind: 'inventory-count', inventoryId: 'missing', compare: 'eq', amount: 0 },
  {
    kind: 'inventory-count',
    inventoryId: 'bag',
    itemId: 'missing',
    compare: 'eq',
    amount: 0,
  },
  { kind: 'inventory-count', inventoryId: 'bag', compare: 'eq', amount: -1 },
  { kind: 'inventory-count', inventoryId: 'bag', compare: 'eq', amount: 1.5 },
  { kind: 'owns-asset', registryId: 'missing', assetId: 'house' },
  { kind: 'owns-asset', registryId: 'land', assetId: 'missing' },
])('rejects an invalid condition before startup: %j', (condition) => {
  expect(() => definition(condition)).toThrow();
});

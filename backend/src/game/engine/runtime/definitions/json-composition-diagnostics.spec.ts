import { compileJsonGame } from './json-game-compiler';
import { AuthoringError } from '../contracts/authoring-error';
import { defineJsonEffectPack } from '../contracts/json-effect-pack';
import { authorObject } from '../contracts/json-author-schema';
import { defineAction } from './game-definition-builders';
import { gameInput } from '../actions/game-input-schema';
import manifest from '../../../testing/fixtures/json-course/manifest.json';
import document from '../../../testing/fixtures/json-course/game.json';

const market = {
  kind: 'market',
  marketId: 'market',
  inventoryId: 'inventory',
  items: ['item'],
  currency: 'coins.local',
  prices: { item: 2 },
  startingCurrency: 10,
  minPrice: 0,
  maxPrice: 10,
  turnsCounterId: 'round.count',
  maxRounds: 3,
  winnerReason: 'winner',
};

it('locates a component explicitly colliding with a pattern component', () => {
  expect(() =>
    compileJsonGame(manifest, {
      ...document,
      patterns: [{ kind: 'race', trackId: 'board', spaces: 10 }],
    }),
  ).toThrow(
    expect.objectContaining({
      code: 'GAME_AUTHORING_ERROR',
      path: 'game.json.components[2].id',
      received: 'board',
    }),
  );
});

it.each([
  [
    { resources: { stars: 0, 'coins.local': 3 } },
    'resources["coins.local"]',
    3,
  ],
  [{ counters: { 'round.count': 7 } }, 'counters["round.count"]', 7],
] as const)(
  'locates initial values replacing pattern-owned values %#',
  (setup, field, received) => {
    let caught: unknown;
    try {
      compileJsonGame(manifest, {
        ...document,
        resourceIds: ['stars', 'coins.local'],
        patterns: [market],
        setup: { ...document.setup, ...setup },
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(AuthoringError);
    expect(caught).toMatchObject({
      path: `game.json.setup.${field}`,
      received,
    });
    expect(caught).toHaveProperty(
      'message',
      expect.stringContaining('overrideInitialization'),
    );
  },
);

it('locates an action colliding with an extension-provided pattern', () => {
  const pack = defineJsonEffectPack({
    capabilities: ['patterns'],
    scope: 'game-specific',
    domain: 'choice',
    documentKey: 'collision',
    outputKey: 'collision',
    schema: authorObject({}),
    compile: (program: Record<string, never>) => program,
    patterns: () => [
      {
        id: 'collision',
        mechanics: [],
        actions: {
          'advance.step': defineAction({
            input: gameInput.object({}),
            execute: () => {},
          }),
        },
      },
    ],
  });
  const action = document.actions.advance;
  expect(() =>
    compileJsonGame(
      manifest,
      {
        ...document,
        actions: { 'advance.step': action },
        phases: { playing: { actions: ['advance.step'], terminal: true } },
        extensions: [{ type: 'collision', config: {} }],
      },
      undefined,
      {},
      [pack],
    ),
  ).toThrow(
    expect.objectContaining({
      code: 'GAME_AUTHORING_ERROR',
      path: 'game.json.actions["advance.step"]',
      received: action,
    }),
  );
});

it('attributes a conflict between patterns to the second pattern, not unrelated setup', () => {
  let caught: unknown;
  try {
    compileJsonGame(manifest, {
      ...document,
      resourceIds: ['stars', 'coins.local'],
      setup: { ...document.setup, resources: { stars: 0, 'coins.local': 3 } },
      patterns: [
        market,
        {
          ...market,
          marketId: 'second',
          inventoryId: 'second',
          turnsCounterId: 'other',
        },
      ],
    });
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(AuthoringError);
  expect(caught).toMatchObject({
    path: 'game.json.patterns[1].currency',
    received: 'coins.local',
  });
});

const race = { kind: 'race', trackId: 'track', spaces: 5 };
it.each([
  [[race, race], 'trackId', 'track'],
  [[race, { ...race, trackId: 'other' }], 'diceId', undefined],
  [[race, { kind: 'simultaneous-answers' }], 'kind', 'simultaneous-answers'],
  [
    [{ kind: 'push-your-luck' }, { kind: 'push-your-luck' }],
    'kind',
    'push-your-luck',
  ],
  [
    [market, { ...market, marketId: 'second', currency: 'other' }],
    'inventoryId',
    'inventory',
  ],
  [
    [
      market,
      {
        ...market,
        marketId: 'second',
        inventoryId: 'second',
        currency: 'other',
      },
    ],
    'turnsCounterId',
    'round.count',
  ],
  [
    [
      { kind: 'pawn-race', pawnSetId: 'p1', spaces: 5, pawns: [{ id: 'p' }] },
      { kind: 'pawn-race', pawnSetId: 'p2', spaces: 5, pawns: [{ id: 'p' }] },
    ],
    'diceId',
    undefined,
  ],
] as const)(
  'locates conflicting pattern declarations %#',
  (patterns, field, received) => {
    expect(() => compileJsonGame(manifest, { ...document, patterns })).toThrow(
      expect.objectContaining({
        code: 'GAME_AUTHORING_ERROR',
        path: `game.json.patterns[1].${field}`,
        received,
      }),
    );
  },
);

it('accepts two races with explicitly distinct component identifiers', () => {
  expect(() =>
    compileJsonGame(manifest, {
      ...document,
      patterns: [race, { ...race, trackId: 'other', diceId: 'other' }],
    }),
  ).not.toThrow();
});

import { compileJsonGame } from '../../../rules/public-api';
import manifest from '../../../testing/fixtures/json-course/manifest.json';
import document from '../../../testing/fixtures/json-course/game.json';
import { AuthoringError, authoringValueAt } from '../contracts/authoring-error';
import { compileJsonGame as compileCore } from './json-game-compiler';
import { defineJsonEffectPack } from '../contracts/json-effect-pack';
import { authorObject } from '../contracts/json-author-schema';
import type { GameEffectInstruction } from '../contracts/effect-ir';

function diagnostic(source: unknown, path: string, received: unknown) {
  try {
    compileJsonGame(manifest, source);
    throw new Error('Expected compilation to fail');
  } catch (error) {
    expect(error).toBeInstanceOf(AuthoringError);
    expect(error).toMatchObject({
      code: 'GAME_AUTHORING_ERROR',
      path,
      received,
    });
    expect(authoringValueAt(source, path.slice('game.json.'.length))).toEqual(
      received,
    );
  }
}

function action(effects: unknown[]) {
  return {
    ...document,
    actions: { 'advance.step': { effects } },
    phases: { playing: { actions: ['advance.step'], terminal: true } },
  };
}

it('locates a reserved resource after resources introduced by a pattern', () => {
  diagnostic(
    {
      ...document,
      resourceIds: ['stars', 'constructor'],
      patterns: [
        {
          kind: 'market',
          marketId: 'market',
          inventoryId: 'inventory',
          items: ['item'],
          currency: 'coins',
          prices: { item: 2 },
          startingCurrency: 10,
          minPrice: 0,
          maxPrice: 10,
          turnsCounterId: 'turns',
          maxRounds: 3,
          winnerReason: 'winner',
        },
      ],
    },
    'game.json.resourceIds[1]',
    'constructor',
  );
});

it.each(['missing', 'constructor', 'toString'])(
  'locates an unknown custom effect %s',
  (effectId) => {
    diagnostic(
      action([{ kind: 'custom', effectId }]),
      'game.json.actions["advance.step"].effects[0].effectId',
      effectId,
    );
  },
);

it('locates nested reactions and quoted option names', () => {
  diagnostic(
    action([
      {
        kind: 'reaction',
        choiceId: 'reaction',
        reactor: { kind: 'self' },
        options: ['a.b'],
        reactions: { 'a.b': [{ kind: 'move', trackId: 'absent', spaces: 1 }] },
      },
    ]),
    'game.json.actions["advance.step"].effects[0].reactions["a.b"][0].trackId',
    'absent',
  );
});

it('locates the invalid card in reaction availability', () => {
  diagnostic(
    action([
      {
        kind: 'reaction',
        choiceId: 'reaction',
        reactor: { kind: 'self' },
        options: ['a', 'absent'],
        reactions: {},
        availability: {
          kind: 'cards',
          handId: 'hand',
          owner: { kind: 'self' },
        },
      },
    ]),
    'game.json.actions["advance.step"].effects[0].options[1]',
    'absent',
  );
});

it('locates nested condition references', () => {
  diagnostic(
    action([
      {
        kind: 'conditional',
        condition: {
          kind: 'all',
          conditions: [{ kind: 'has-resource', resource: 'absent', amount: 1 }],
        },
        then: [],
      },
    ]),
    'game.json.actions["advance.step"].effects[0].condition.conditions[0].resource',
    'absent',
  );
});

it.each([
  [{ actions: ['advance', 'absent'], terminal: true }, 'actions[1]', 'absent'],
  [
    { actions: ['advance'], transitions: ['absent'] },
    'transitions[0]',
    'absent',
  ],
  [{ actions: ['advance'], next: 'absent' }, 'next', 'absent'],
] as const)(
  'locates invalid phase references %#',
  (phase, suffix, received) => {
    diagnostic(
      {
        ...document,
        initialPhase: 'play.step',
        phases: { 'play.step': phase },
      },
      `game.json.phases["play.step"].${suffix}`,
      received,
    );
  },
);

it.each(['cards', 'catalog'] as const)(
  'distinguishes deck %s indices',
  (field) => {
    const card = { id: 'a', effects: [{ kind: 'custom', effectId: 'absent' }] };
    diagnostic(
      {
        ...document,
        components: [
          {
            component: 'cards.deck',
            id: 'deck',
            cards: field === 'cards' ? [card] : ['a'],
            ...(field === 'catalog' ? { catalog: [card] } : {}),
          },
          ...document.components.slice(1),
        ],
      },
      `game.json.components[0].${field}[0].effects[0].effectId`,
      'absent',
    );
  },
);

it('locates a missing component reference by index', () => {
  diagnostic(
    {
      ...document,
      components: [
        document.components[0],
        { ...document.components[1], deck: 'absent' },
        document.components[2],
      ],
    },
    'game.json.components[1].deck',
    'absent',
  );
});

it('locates initialization keys containing dots', () => {
  diagnostic(
    {
      ...document,
      setup: { ...document.setup, tracks: { 'missing.track': 0 } },
    },
    'game.json.setup.tracks["missing.track"]',
    0,
  );
});

it('locates the player whose initial position exceeds the track', () => {
  diagnostic(
    {
      ...document,
      setup: { ...document.setup, tracks: { board: { '1': 0, '2': 99 } } },
    },
    'game.json.setup.tracks.board.2',
    99,
  );
});

it('locates the second occurrence of a duplicate component', () => {
  diagnostic(
    {
      ...document,
      components: [...document.components, document.components[2]],
    },
    'game.json.components[3].id',
    'board',
  );
});

it('locates an unknown card inside a named set', () => {
  diagnostic(
    {
      ...document,
      components: [
        ...document.components,
        {
          component: 'cards.sets',
          id: 'sets',
          hand: 'hand',
          deck: 'deck',
          sets: { 'set.one': ['a', 'absent'] },
        },
      ],
    },
    'game.json.components[3].sets["set.one"][1]',
    'absent',
  );
});

it('locates a collection source with a dotted name', () => {
  diagnostic(
    {
      ...document,
      components: [
        ...document.components,
        {
          component: 'collection.view',
          id: 'collection',
          groups: { 'group.one': { kind: 'inventory', id: 'absent' } },
        },
      ],
    },
    'game.json.components[3].groups["group.one"].id',
    'absent',
  );
});

it('locates a missing initial pawn set', () => {
  diagnostic(
    { ...document, setup: { ...document.setup, pawns: [{ setId: 'absent' }] } },
    'game.json.setup.pawns[0].setId',
    'absent',
  );
});

it('locates a missing initial deal destination', () => {
  diagnostic(
    {
      ...document,
      setup: {
        ...document.setup,
        deals: [{ deckId: 'deck', handId: 'absent', count: 1 }],
      },
    },
    'game.json.setup.deals[0].handId',
    'absent',
  );
});

it('keeps the original extension value when adapting a late diagnostic', () => {
  const pack = defineJsonEffectPack({
    scope: 'game-specific',
    domain: 'cards',
    documentKey: 'diagnostic',
    outputKey: 'diagnostic',
    schema: authorObject({
      cards: {
        type: 'array',
        items: authorObject({
          effects: { type: 'array', items: { $ref: '#/$defs/effect' } },
        }),
      },
    }),
    compile: (program: { cards: { effects: GameEffectInstruction[] }[] }) =>
      program,
  });
  const source = {
    ...document,
    extensions: [
      {
        type: 'diagnostic',
        config: {
          cards: [{ effects: [{ kind: 'custom', effectId: 'absent' }] }],
        },
      },
    ],
  };
  expect(() => compileCore(manifest, source, undefined, {}, [pack])).toThrow(
    expect.objectContaining({
      code: 'GAME_AUTHORING_ERROR',
      path: 'game.json.extensions[0].config.cards[0].effects[0].effectId',
      received: 'absent',
    }),
  );
});

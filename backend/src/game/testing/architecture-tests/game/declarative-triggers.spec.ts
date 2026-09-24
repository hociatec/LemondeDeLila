import { compileJsonGame } from '../../../engine/runtime/definitions/json-game-compiler';
import {
  defineGame,
  defineAction,
  gameInput,
  triggerPattern,
  thresholdVictory,
  type DeclarativeTrigger,
} from '../../../engine/sdk/public-api';
import { testGame } from '../../../engine/testing/public-api';
import manifest from '../../fixtures/json-course/manifest.json';
import document from '../../fixtures/json-course/game.json';

const triggers: DeclarativeTrigger[] = [
  {
    id: 'action-reward',
    on: { kind: 'action', type: 'advance' },
    effects: [{ kind: 'gain-resource', resource: 'stars', amount: 1 }],
  },
  {
    id: 'landing-reward',
    on: {
      kind: 'event',
      type: 'pawn.landed',
      equals: { trackId: 'board', position: 1 },
    },
    condition: { kind: 'phase-is', phase: 'playing' },
    effects: [
      {
        kind: 'gain-score',
        amount: { kind: 'resource-value', resource: 'stars' },
      },
    ],
  },
  {
    id: 'resource-reward',
    on: {
      kind: 'event',
      type: 'resource.changed',
      equals: { resource: 'stars', value: 3 },
    },
    effects: [{ kind: 'gain-score', amount: 5 }],
  },
];

it('keeps opaque status metadata separate from executable trigger instructions', () => {
  expect(() =>
    triggerPattern({
      id: 'metadata',
      on: { kind: 'action', type: 'advance' },
      effects: [
        { kind: 'add-status', status: 'tag', data: { kind: 'custom' } },
      ],
    }),
  ).not.toThrow();
});

function jsonDefinition(rules = triggers) {
  return compileJsonGame(manifest, {
    ...document,
    setup: { ...document.setup, scores: 0, resources: { stars: 2 } },
    patterns: rules.map((rule) => ({ kind: 'trigger', ...rule })),
    phases: { playing: { actions: ['advance'], terminal: true } },
    actions: {
      advance: { effects: [{ kind: 'move', trackId: 'board', spaces: 1 }] },
    },
    victory: { kind: 'score-at-least', amount: 100 },
  });
}

it.each([3, 19, 67])(
  'composes action, selector, condition, calculation and event effects identically in JSON/API (seed %i)',
  async (seed) => {
    const json = jsonDefinition();
    const sdk = defineGame<Record<string, never>>()({
      id: manifest.code,
      displayName: manifest.name,
      category: document.category,
      players: { min: manifest.minPlayers, max: manifest.maxPlayers },
      content: json.content,
      components: json.components,
      resourceIds: json.resourceIds,
      initialization: json.initialization,
      initialPhase: json.initialPhase,
      phases: json.phases,
      patterns: triggers.map((rule) =>
        triggerPattern<Record<string, never>>(rule),
      ),
      victory: thresholdVictory({ kind: 'score-at-least', amount: 100 }),
      actions: {
        advance: defineAction<Record<string, never>, Record<string, never>>({
          input: gameInput.object({}),
          execute: ({ ctx }) =>
            ctx.effects.run({ kind: 'move', trackId: 'board', spaces: 1 }),
        }),
      },
    });
    const games = await Promise.all([
      testGame(json).players(2).seed(seed).start(),
      testGame(sdk).players(2).seed(seed).start(),
    ]);
    await games[0].as(1).do('advance', {});
    await games[1].as(1).do('advance', {});
    for (const game of games) {
      expect(game.state()).toHaveProperty('engine.playerValues.scores.1', 8);
      expect(game.state()).toHaveProperty(
        'engine.playerValues.resources.stars.1',
        3,
      );
      expect(await game.replay()).toEqual(game.state());
    }
    const left = games[0].state(),
      right = games[1].state();
    if (!('engine' in left) || !('engine' in right))
      throw new Error('Missing engine state');
    expect(right.engine).toEqual(left.engine);
  },
);

it('rejects a cyclic resource trigger and rolls back the entire command', async () => {
  const game = await testGame(
    jsonDefinition([
      triggers[0],
      {
        id: 'loop',
        on: { kind: 'event', type: 'resource.changed' },
        condition: { kind: 'has-resource', resource: 'stars', amount: 3 },
        effects: [{ kind: 'gain-resource', resource: 'stars', amount: 1 }],
      },
    ]),
  )
    .players(2)
    .start();
  const before = game.state();
  await expect(game.as(1).do('advance', {})).rejects.toThrow(/budget/);
  expect(game.state()).toEqual(before);
});

it('rejects unknown actions, unknown resources and interactive trigger effects during authoring', () => {
  expect(() =>
    jsonDefinition([
      { ...triggers[0], on: { kind: 'action', type: 'missing' } },
    ]),
  ).toThrow(/unknown action/);
  expect(() =>
    jsonDefinition([
      {
        ...triggers[0],
        effects: [{ kind: 'gain-resource', resource: 'missing', amount: 1 }],
      },
    ]),
  ).toThrow(/missing/);
  expect(() =>
    jsonDefinition([
      {
        ...triggers[0],
        effects: [
          {
            kind: 'gain-score',
            amount: 1,
            target: { kind: 'chosen-opponent' },
          },
        ],
      },
    ]),
  ).toThrow(/non-interactive/);
});

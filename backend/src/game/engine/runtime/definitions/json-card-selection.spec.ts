import { compileJsonGame } from './json-game-compiler';
import { testGame } from '../../../core/testing/game-test-kit';
import { DeclarativeGameRuntime } from '../declarative-game.runtime';
import { GameRuleViolationError } from '../../../core/domain/errors/game-domain.errors';
import type { CardSelectionProgram } from '../effect-packs/choice-card-occurrences/program';
import type { CardValue } from '../cards/cards-contracts';
import manifest from '../../../testing/fixtures/json-course/manifest.json';
import document from '../../../testing/fixtures/json-course/game.json';

function definition(
  kind: 'deck' | 'hand' | 'discard',
  overrides: Partial<CardSelectionProgram> = {},
  cards: CardValue[] = ['a', 'b', 'a', 'c'],
) {
  const selectCards: CardSelectionProgram = {
    choiceId: 'pick-cards',
    source:
      kind === 'hand'
        ? { kind, deckId: 'deck', handId: 'hand' }
        : { kind, deckId: 'deck' },
    destination: { kind: 'hand', handId: 'hand', owner: 'next' },
    filter: { includeIds: ['a'] },
    min: 2,
    max: 2,
    shortfall: 'reject',
    timeout: { afterMs: 10, strategy: 'random' },
    completeTurn: true,
    ...overrides,
  };
  return compileJsonGame(manifest, {
    ...document,
    setup: { firstPlayer: 'first' },
    components: [
      { component: 'cards.deck', id: 'deck', cards },
      {
        component: 'cards.hands',
        id: 'hand',
        deck: 'deck',
        initial: kind === 'deck' ? 0 : 2,
        visibility: 'owner',
      },
    ],
    phases: { playing: { actions: ['advance', 'prepare'], terminal: true } },
    actions: {
      advance: { selectCards },
      prepare: {
        effects: [
          { kind: 'discard-random', handId: 'hand', deckId: 'deck', count: 2 },
        ],
      },
    },
  });
}

it.each(['deck', 'hand', 'discard'] as const)(
  'selects duplicate physical copies from %s and completes the turn',
  async (kind) => {
    const game = await testGame(definition(kind)).players(2).seed(42).start();
    if (kind === 'discard') await game.as(1).do('prepare', {});
    await game.as(1).do('advance', {});
    const before = game.state();
    await game.as(1).do('choice.resolve', { value: [0, 1] });
    expect(
      game.inspect.hand(2, 'hand').filter((card) => card === 'a'),
    ).toHaveLength(2);
    expect(game.state()).toHaveProperty('turn.currentPlayerId', 2);
    expect(before).toHaveProperty('pending.data.options', [0, 1]);
    expect(await game.replay()).toEqual(game.state());
  },
);
it('resolves card selection after JSON persistence and timeout', async () => {
  const compiled = definition('deck');
  const game = await testGame(compiled).players(2).seed(42).start();
  await game.as(1).do('advance', {});
  game.advanceTime(10);
  await game.as(1).do('choice.timeout', {});
  expect(game.inspect.hand(2, 'hand')).toEqual(['a', 'a']);
  expect(await game.replay()).toEqual(game.state());
});

it('rejects repeated occurrences without mutating cards', async () => {
  const game = await testGame(definition('deck')).players(2).start();
  await game.as(1).do('advance', {});
  const before = game.state();
  await expect(
    game.as(1).do('choice.resolve', { value: [0, 0] }),
  ).rejects.toThrow();
  expect(game.state()).toEqual(before);
});

it('keeps candidates private to the chooser and never exposes continuation cards', async () => {
  const game = await testGame(definition('deck')).players(2).start();
  await game.as(1).do('advance', {});
  expect(game.view(1)).toHaveProperty('pending.data.options', [0, 1]);
  expect(game.view(1)).not.toHaveProperty('pending.data.continuationData');
  expect(game.view(2)).not.toHaveProperty('pending.choices');
  expect(game.view(2)).not.toHaveProperty('pending.data');
});

it('projects only documented choice fields even when internal data grows', async () => {
  const compiled = definition('deck');
  const game = await testGame(compiled).players(2).start();
  await game.as(1).do('advance', {});
  const source = game.state();
  Object.assign(source.pending?.data ?? {}, {
    internalSecret: { deckOrder: ['secret'] },
    choiceActionsByIndex: [{ type: 'internal-only' }],
  });
  const runtime = new DeclarativeGameRuntime(compiled);
  const view = runtime.exposeStateForUser(source, 1);
  expect(view.pending?.data).toEqual({
    kind: 'many',
    choiceId: 'pick-cards',
    options: [0, 1],
    min: 2,
    max: 2,
    timeoutStrategy: 'random',
    deadlineMs: source.pending?.data?.deadlineMs,
  });
  expect(runtime.exposeStateForUser(source, 2).pending?.data).toBeUndefined();
  expect(
    runtime.exposeStateForUser(source, null).pending?.data,
  ).toBeUndefined();
  expect(source.pending?.data).toHaveProperty('internalSecret');
});

it('disables an impossible selection but can explicitly select the available cards', async () => {
  const strict = await testGame(definition('deck', { min: 3, max: 3 }))
    .players(2)
    .start();
  expect(strict.availableActions(1)).not.toContain('advance');
  const partial = await testGame(
    definition('deck', { min: 3, max: 3, shortfall: 'available' }),
  )
    .players(2)
    .start();
  await partial.as(1).do('advance', {});
  expect(partial.state()).toHaveProperty('pending.data.min', 2);
  await partial.as(1).do('choice.resolve', { value: [0, 1] });
  expect(partial.inspect.hand(2, 'hand')).toEqual(['a', 'a']);
});

it('allows the explicit available fallback to complete an empty selection', async () => {
  const game = await testGame(
    definition('deck', {
      filter: { includeIds: [] },
      shortfall: 'available',
    }),
  )
    .players(2)
    .start();
  await game.as(1).do('advance', {});
  await game.as(1).do('choice.resolve', { value: [] });
  expect(game.inspect.hand(2, 'hand')).toEqual([]);
  expect(game.state()).toHaveProperty('turn.currentPlayerId', 2);
  expect(await game.replay()).toEqual(game.state());
});

it('applies exclusions, discards selected cards and runs standard follow-up effects', async () => {
  const game = await testGame(
    definition('deck', {
      filter: { excludeIds: ['a'] },
      destination: { kind: 'discard' },
      effects: [{ kind: 'gain-score', amount: 2 }],
    }),
  )
    .players(2)
    .start();
  await game.as(1).do('advance', {});
  await game.as(1).do('choice.resolve', { value: [0, 1] });
  expect(game.state()).toHaveProperty('engine.kits.cards.discards.deck', [
    'b',
    'c',
  ]);
  expect(game.state()).toHaveProperty('engine.playerValues.scores.1', 2);
});

it('rejects a forged continuation owner before touching the source', async () => {
  const compiled = definition('hand');
  const game = await testGame(compiled).players(2).start();
  await game.as(1).do('advance', {});
  const source = game.state();
  const data = source.pending?.data?.continuationData;
  if (!data || typeof data !== 'object')
    throw new Error('Missing continuation fixture');
  Object.assign(data, { destinationPlayerId: 1 });
  const before = structuredClone(source);
  expect(() =>
    new DeclarativeGameRuntime(compiled).applyActions(source, [
      {
        type: 'choice.resolve',
        payload: { value: [0, 1] },
        meta: { actorId: 1 },
      },
    ]),
  ).toThrow(GameRuleViolationError);
  expect(source).toEqual(before);
});

it.each<Partial<CardSelectionProgram>>([
  { source: { kind: 'deck', deckId: 'unknown' } },
  { destination: { kind: 'hand', handId: 'unknown' } },
  { filter: { includeIds: ['unknown'] } },
  { filter: { attributes: { typo: true } } },
  { min: 3, max: 2 },
  { effects: [{ kind: 'move', trackId: 'unknown', spaces: 1 }] },
])('rejects invalid selection references before runtime: %j', (overrides) => {
  expect(() => definition('deck', overrides)).toThrow();
});

it.each(['first', 'last', 'random'] as const)(
  'delegates a private selection and its %s timeout without changing transfer owners',
  async (strategy) => {
    const game = await testGame(
      definition('hand', {
        chooser: 'next',
        min: 1,
        max: 1,
        filter: {},
        timeout: { afterMs: 10, strategy },
      }),
    )
      .players(2)
      .seed(42)
      .start();
    await game.as(1).do('advance', {});
    expect(game.view(1)).not.toHaveProperty('pending.data');
    expect(game.view(2)).toHaveProperty('pending.data.options', [0, 1]);
    const before = game.state();
    await expect(
      game.as(1).do('choice.resolve', { value: [0] }),
    ).rejects.toThrow();
    expect(game.state()).toEqual(before);
    game.advanceTime(10);
    await game.as(2).do('choice.timeout', {});
    expect(game.inspect.hand(1, 'hand')).toHaveLength(1);
    expect(game.inspect.hand(2, 'hand')).toHaveLength(3);
    expect(await game.replay()).toEqual(game.state());
  },
);

it.each(['deck', 'hand', 'discard'] as const)(
  'combines attribute filters with exclusions from %s',
  async (kind) => {
    const cards = [
      {
        id: 'a',
        attributes: { color: 'red', points: 2, wild: false, tag: null },
      },
      {
        id: 'b',
        attributes: { color: 'blue', points: 2, wild: false, tag: null },
      },
      {
        id: 'a2',
        attributes: { color: 'red', points: 2, wild: false, tag: null },
      },
      {
        id: 'c',
        attributes: { color: 'red', points: 2, wild: false, tag: null },
      },
    ];
    const game = await testGame(
      definition(
        kind,
        {
          filter: {
            excludeIds: ['c'],
            attributes: { color: 'red', points: 2, wild: false, tag: null },
          },
        },
        cards,
      ),
    )
      .players(2)
      .start();
    if (kind === 'discard') await game.as(1).do('prepare', {});
    await game.as(1).do('advance', {});
    await game.as(1).do('choice.resolve', { value: [0, 1] });
    expect(game.inspect.hand(2, 'hand').slice(-2).sort()).toEqual(['a', 'a2']);
    expect(await game.replay()).toEqual(game.state());
  },
);

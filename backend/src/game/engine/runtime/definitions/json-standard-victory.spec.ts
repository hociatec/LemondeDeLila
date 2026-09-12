import { compileJsonGame } from './json-game-compiler';
import { testGame } from '../../../core/testing/game-test-kit';
import type { GameEffectInstruction } from '../contracts/effect-ir';
import type { JsonStandardVictory } from './json-standard-victory';
import manifest from '../../../testing/fixtures/json-course/manifest.json';
import document from '../../../testing/fixtures/json-course/game.json';

function definition(
  victory: JsonStandardVictory,
  effects: readonly GameEffectInstruction[],
) {
  return compileJsonGame(manifest, {
    ...document,
    setup: {
      ...document.setup,
      scores: 5,
      resources: { stars: { '1': 2, '2': 3 } },
    },
    phases: { playing: { actions: ['advance', 'restart'], terminal: true } },
    actions: {
      advance: { effects },
      restart: {
        effects: [{ kind: 'start-round' }, { kind: 'complete-turn' }],
      },
    },
    victory,
  });
}

it.each([
  { ties: 'all' as const, winners: [1, 2] },
  { ties: 'lowest-id' as const, winners: [1] },
])(
  'declares a finish-line victory with $ties tie resolution',
  async ({ ties, winners }) => {
    const game = await testGame(
      definition({ kind: 'track-finish', trackId: 'board', ties }, [
        {
          kind: 'move-to',
          trackId: 'board',
          position: 9,
          target: { kind: 'all-players' },
        },
      ]),
    )
      .players(2)
      .start();
    expect(game.state().status).not.toBe('finished');
    await game.as(1).do('advance', {});
    expect(game.state()).toHaveProperty(
      'engine.match.result.winnerPlayerIds',
      winners,
    );
    expect(await game.replay()).toEqual(game.state());
  },
);

it('declares elimination and last-player victory entirely in JSON', async () => {
  const game = await testGame(
    definition({ kind: 'last-player' }, [
      { kind: 'eliminate-player', target: { kind: 'next' } },
    ]),
  )
    .players(2)
    .start();
  await game.as(1).do('advance', {});
  expect(game.state()).toHaveProperty(
    'engine.match.result.winnerPlayerIds',
    [1],
  );
  expect(game.state()).toHaveProperty(
    'engine.match.playerStatuses.2',
    'eliminated',
  );
  expect(await game.replay()).toEqual(game.state());
});

it('finishes without a winner if all remaining players are eliminated together', async () => {
  const game = await testGame(
    definition({ kind: 'last-player' }, [
      { kind: 'eliminate-player', target: { kind: 'all-players' } },
    ]),
  )
    .players(2)
    .start();
  await game.as(1).do('advance', {});
  expect(game.state().status).toBe('finished');
  expect(game.state()).toHaveProperty(
    'engine.match.result.winnerPlayerIds',
    [],
  );
  expect(await game.replay()).toEqual(game.state());
});

it('ends after the declared rounds and ranks using ordered score/resource criteria', async () => {
  const game = await testGame(
    definition(
      {
        kind: 'rounds-completed',
        amount: 2,
        participants: 'all',
        ties: 'all',
        ranking: [
          { kind: 'score', direction: 'desc' },
          { kind: 'resource', resource: 'stars', direction: 'asc' },
        ],
      },
      [{ kind: 'end-round' }],
    ),
  )
    .players(2)
    .start();
  await game.as(1).do('advance', {});
  expect(game.state().status).not.toBe('finished');
  await game.as(1).do('restart', {});
  await game.as(2).do('advance', {});
  expect(game.state()).toHaveProperty('engine.match.result', {
    winnerPlayerIds: [1],
    reason: 'rounds-completed',
    ranking: [[1], [2]],
  });
  expect(await game.replay()).toEqual(game.state());
});

it.each(['all', 'lowest-id'] as const)(
  'applies the explicit %s tie policy after rounds',
  async (ties) => {
    const game = await testGame(
      definition(
        {
          kind: 'rounds-completed',
          amount: 1,
          participants: 'active',
          ties,
          ranking: [{ kind: 'score', direction: 'desc' }],
        },
        [{ kind: 'end-round' }],
      ),
    )
      .players(2)
      .start();
    await game.as(1).do('advance', {});
    expect(game.state()).toHaveProperty(
      'engine.match.result.winnerPlayerIds',
      ties === 'all' ? [1, 2] : [1],
    );
  },
);

it('rejects repeated round completion atomically', async () => {
  const game = await testGame(
    definition({ kind: 'score-at-least', amount: 100 }, [
      { kind: 'gain-score', amount: 1 },
      { kind: 'end-round' },
      { kind: 'end-round' },
    ]),
  )
    .players(2)
    .start();
  const before = game.state();
  await expect(game.as(1).do('advance', {})).rejects.toThrow();
  expect(game.state()).toEqual(before);
});

it.each([
  { kind: 'track-finish', trackId: 'missing', ties: 'all' },
  { kind: 'track-finish', trackId: 'board' },
  {
    kind: 'rounds-completed',
    amount: 0,
    participants: 'all',
    ties: 'all',
    ranking: [],
  },
  {
    kind: 'rounds-completed',
    amount: 2,
    participants: 'all',
    ties: 'all',
    ranking: [{ kind: 'resource', resource: 'missing', direction: 'desc' }],
  },
])('rejects invalid victory content before setup: %j', (victory) => {
  expect(() => compileJsonGame(manifest, { ...document, victory })).toThrow();
});

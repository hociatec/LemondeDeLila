import { thresholdVictory, type ThresholdVictory } from './threshold-victory';
import type { GameContext } from '../definitions/game-author-context';

const players = [{ id: 3 }, { id: 2 }, { id: 1 }];
function outcome(rule: ThresholdVictory, scores = { 1: 10, 2: 10, 3: 5 }) {
  const values: Record<number, number> = scores;
  const ctx = {
    players: {
      all: () => players,
      active: () => players.filter((p) => p.id !== 1),
    },
    score: { get: (id: number) => values[id] },
    resources: {
      get: (id: number, resource: string) =>
        resource === 'stars' ? values[id] : 0,
    },
  } as GameContext<Record<string, never>>;
  return thresholdVictory(rule).evaluate({ state: {}, ctx });
}

it('keeps active eligibility distinct from all-player thresholds', () => {
  expect(
    outcome({ kind: 'score-at-least', amount: 10 })?.winnerPlayerIds,
  ).toEqual([2]);
  expect(
    outcome({ kind: 'score-at-least', amount: 10, participants: 'all' })
      ?.winnerPlayerIds,
  ).toEqual([2, 1]);
});

it('preserves a continued game on ties when uniqueness is required', () => {
  expect(
    outcome({
      kind: 'score-at-least',
      amount: 10,
      participants: 'all',
      selection: 'unique-qualified',
    }),
  ).toBeNull();
  expect(outcome({ kind: 'score-at-least', amount: 11 })).toBeNull();
});

it('uses highest value then lowest player ID for the explicit single-winner policy', () => {
  const rule: ThresholdVictory = {
    kind: 'score-at-least',
    amount: 10,
    participants: 'all',
    selection: 'highest-value-lowest-id',
    reason: 'prestige',
  };
  expect(outcome(rule)).toEqual({ winnerPlayerIds: [1], reason: 'prestige' });
  expect(outcome(rule, { 1: 10, 2: 12, 3: 5 })?.winnerPlayerIds).toEqual([2]);
});

it('supports resource thresholds and rejects invalid numeric configuration', () => {
  expect(
    outcome({ kind: 'resource-at-least', resource: 'stars', amount: 10 })
      ?.winnerPlayerIds,
  ).toEqual([2]);
  for (const amount of [NaN, Infinity, 0, -1])
    expect(() =>
      thresholdVictory({ kind: 'score-at-least', amount }),
    ).toThrow();
});

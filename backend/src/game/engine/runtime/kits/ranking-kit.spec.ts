import { GameRuleViolationError } from '../../../core/domain/errors/game-domain.errors';
import { GameRankingController } from './ranking-kit';

it.each([NaN, Infinity, -Infinity])(
  'rejects an unordered numeric criterion: %s',
  (value) => {
    expect(() =>
      new GameRankingController().rank([1, 2], { value: () => value }),
    ).toThrow(GameRuleViolationError);
  },
);

it.each([[1, 1], [0], [1.5], [Infinity]])(
  'rejects invalid or duplicated ranking participants: %j',
  (...ids) => {
    expect(() => new GameRankingController().rank(ids)).toThrow(
      GameRuleViolationError,
    );
  },
);

it('gives tied players equal ranks with stable player-ID order independent of input order', () => {
  const ranking = new GameRankingController();
  const criterion = { value: (id: number) => (id === 3 ? 5 : 10) };
  const result = ranking.rank([3, 2, 1], criterion);
  expect(result).toEqual([
    { playerId: 1, rank: 1, values: [10] },
    { playerId: 2, rank: 1, values: [10] },
    { playerId: 3, rank: 3, values: [5] },
  ]);
  expect(ranking.rank([1, 3, 2], criterion)).toEqual(result);
  expect(ranking.tiers([3, 2, 1], criterion)).toEqual([[1, 2], [3]]);
});

it('applies ordered criteria with explicit ascending and descending directions', () => {
  const ranking = new GameRankingController();
  expect(
    ranking
      .rank(
        [1, 2, 3],
        { value: (id) => (id === 3 ? 0 : 1) },
        { value: (id) => -id, direction: 'asc' },
      )
      .map((entry) => entry.playerId),
  ).toEqual([2, 1, 3]);
});

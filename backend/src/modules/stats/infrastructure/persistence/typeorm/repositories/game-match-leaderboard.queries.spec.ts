import { GameMatchLeaderboardQueries } from './game-match-leaderboard.queries';

function queries(row: Record<string, unknown>): GameMatchLeaderboardQueries {
  const builder = {
    ...Object.fromEntries(
      [
        'innerJoin',
        'select',
        'addSelect',
        'where',
        'andWhere',
        'groupBy',
        'orderBy',
        'addOrderBy',
        'limit',
      ].map((method) => [method, jest.fn().mockReturnThis()]),
    ),
    getRawMany: jest.fn().mockResolvedValue([row]),
  };
  return new GameMatchLeaderboardQueries(
    {} as never,
    { createQueryBuilder: () => builder } as never,
  );
}

const row = {
  userId: '12',
  username: 'Lila',
  wins: '3',
  losses: '2',
  finished: '5',
  quit: null,
};
it('maps SQL decimal strings to exact leaderboard numbers', async () => {
  await expect(queries(row).getTop10('example')).resolves.toEqual([
    { userId: 12, username: 'Lila', wins: 3, losses: 2, finished: 5, quit: 0 },
  ]);
});
it.each(['userId', 'wins', 'losses', 'finished', 'quit'])(
  'rejects malformed or unsafe SQL %s instead of exposing an incorrect number',
  async (field) => {
    for (const value of [true, '12tail', 'Infinity', '9007199254740992', -1]) {
      await expect(
        queries({ ...row, [field]: value }).getTop10('example'),
      ).rejects.toThrow();
    }
  },
);

import { MysqlGameActiveSessionsReader } from './mysql-game-active-sessions.reader';

it('paginates by the complete key and returns only session identifiers', async () => {
  const query = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    maxExecutionTime: jest.fn().mockReturnThis(),
    getMany: jest.fn(async () => [
      { roomId: 2, gameType: 'game', state: { secret: true } },
    ]),
  };
  const reader = new MysqlGameActiveSessionsReader({
    createQueryBuilder: () => query,
  } as never);
  await expect(
    reader.listAfter({ roomId: 1, gameType: 'game' }, 100),
  ).resolves.toEqual([{ roomId: 2, gameType: 'game' }]);
  expect(query.andWhere).toHaveBeenCalledWith(
    '(session.roomId > :roomId OR (session.roomId = :roomId AND session.gameType > :gameType))',
    { roomId: 1, gameType: 'game' },
  );
  expect(query.orderBy).toHaveBeenCalledWith('session.roomId', 'ASC');
  expect(query.addOrderBy).toHaveBeenCalledWith('session.gameType', 'ASC');
  expect(query.take).toHaveBeenCalledWith(100);
  expect(query.maxExecutionTime).toHaveBeenCalledWith(1000);
});

it.each([0, -1, 101, Infinity, 0.5])(
  'rejects an unbounded page size: %s',
  async (limit) => {
    const createQueryBuilder = jest.fn();
    const reader = new MysqlGameActiveSessionsReader({
      createQueryBuilder,
    } as never);
    await expect(reader.listAfter(null, limit)).rejects.toThrow('page size');
    expect(createQueryBuilder).not.toHaveBeenCalled();
  },
);

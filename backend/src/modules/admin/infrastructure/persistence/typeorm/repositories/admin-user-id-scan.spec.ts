import type { Repository } from 'typeorm';
import type { User } from '../../../../../user/infrastructure/persistence/typeorm/entities/user.entity';
import { UserAdministrationTypeormRepository } from '../../../../../user/infrastructure/persistence/typeorm/repositories/user-administration-typeorm.repository';

function setup(maximum: number | null, batches: { id: number | string }[][]) {
  const query = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue({ maximum }),
    getRawMany: jest
      .fn()
      .mockImplementation(() => Promise.resolve(batches.shift() ?? [])),
  };
  const users = {
    createQueryBuilder: () => query,
  } as unknown as Repository<User>;
  return {
    query,
    repository: new UserAdministrationTypeormRepository(users, {
      now: () => Date.now(),
    }),
  };
}

describe('admin user ID scanning', () => {
  it('uses stable keyset batches beyond 100000 IDs and freezes the upper bound', async () => {
    const { query, repository } = setup(100002, [
      [{ id: 1 }, { id: '100000' }],
      [{ id: 100002 }],
    ]);
    const ids: number[] = [];
    for await (const batch of repository.scanIdBatches()) ids.push(...batch);
    expect(ids).toEqual([1, 100000, 100002]);
    expect(query.getRawOne).toHaveBeenCalledTimes(1);
    expect(query.where.mock.calls.map((call) => call[1])).toEqual([
      { afterId: 0, maximum: 100002 },
      { afterId: 100000, maximum: 100002 },
    ]);
    expect(query.orderBy).toHaveBeenCalledWith('user.id', 'ASC');
    expect(query.limit.mock.calls).toEqual([[100], [100]]);
  });

  it.each([0, -1, Infinity, 1.5])(
    'rejects invalid SQL IDs %s before yielding',
    async (id) => {
      const { repository } = setup(10, [[{ id }]]);
      const iterator = repository.scanIdBatches()[Symbol.asyncIterator]();
      await expect(iterator.next()).rejects.toThrow(
        'Invalid user ID scan order',
      );
    },
  );

  it('stops when concurrent deletion empties the remaining range', async () => {
    const { repository, query } = setup(10, [[{ id: 1 }], []]);
    const ids: number[] = [];
    for await (const batch of repository.scanIdBatches()) ids.push(...batch);
    expect(ids).toEqual([1]);
    expect(query.getRawMany).toHaveBeenCalledTimes(2);
  });
});

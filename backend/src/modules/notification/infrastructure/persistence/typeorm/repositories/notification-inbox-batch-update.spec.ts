import { NotificationInboxTypeormRepository } from './notification-inbox-typeorm.repository';

it('updates a contact thread in one bounded statement', async () => {
  const execute = jest.fn(async () => ({ affected: 2 }));
  const builder = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    execute,
  };
  const repository = new NotificationInboxTypeormRepository(
    { createQueryBuilder: () => builder } as never,
    { now: () => 0 },
  );
  await expect(
    repository.updatePayloads([
      { id: 'first', payload: { status: 'handled' } },
      { id: 'second', payload: { status: 'open' } },
    ]),
  ).resolves.toBe(2);
  expect(execute).toHaveBeenCalledTimes(1);
  expect(builder.where).toHaveBeenCalledWith(
    'id IN (:...ids)',
    expect.objectContaining({
      ids: ['first', 'second'],
      id0: 'first',
      id1: 'second',
    }),
  );
});

it('persists large deliveries atomically in bounded chunks', async () => {
  const save = jest.fn(async () => []);
  const rows = {
    create: jest.fn((value) => value),
    save,
  };
  const manager = {
    getRepository: () => rows,
    transaction: jest.fn(async (work) => work(manager)),
  };
  const repository = new NotificationInboxTypeormRepository(
    { manager } as never,
    { now: () => 0 },
  );
  await repository.createMany(
    Array.from({ length: 1_001 }, (_, index) => ({
      id: `item-${index}`,
      userId: index + 1,
      kind: 'admin_contact',
      createdAt: new Date(0),
    })),
  );
  expect(manager.transaction).toHaveBeenCalledTimes(1);
  expect(save.mock.calls.map(([items]) => items.length)).toEqual([500, 500, 1]);
});

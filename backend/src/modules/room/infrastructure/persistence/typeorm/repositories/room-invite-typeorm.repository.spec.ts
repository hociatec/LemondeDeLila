import type { EntityManager, Repository } from 'typeorm';
import { RoomInviteEntity } from '../entities/room-invite.entity';
import { RoomInviteTypeormRepository } from './room-invite-typeorm.repository';

function fixture(current: RoomInviteEntity | null) {
  const rows = {
    findOne: jest.fn(async () => current),
    save: jest.fn(async (value: RoomInviteEntity) => value),
    delete: jest.fn(async () => ({ affected: 1 })),
  };
  const manager = {
    getRepository: () => rows,
    transaction: async (work: (manager: EntityManager) => Promise<unknown>) =>
      work(manager as EntityManager),
  };
  const repository = {
    manager,
    find: jest.fn(async () => []),
    delete: jest.fn(async () => ({ affected: 0 })),
  } as unknown as Repository<RoomInviteEntity>;
  return {
    rows,
    repository: new RoomInviteTypeormRepository(repository),
    raw: repository,
  };
}

it('locks and removes a one-shot invitation atomically', async () => {
  const entity = Object.assign(new RoomInviteEntity(), {
    id: 'invite',
    roomId: 1,
    fromUserId: 2,
    toUserId: 3,
    createdAt: new Date(10),
    expiresAt: new Date(1_000),
    consumedAt: null,
  });
  const test = fixture(entity);
  await expect(
    test.repository.consume('invite', 100, 100, false),
  ).resolves.toMatchObject({ id: 'invite' });
  expect(test.rows.findOne).toHaveBeenCalledWith(
    expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
  );
  expect(test.rows.delete).toHaveBeenCalledWith({ id: 'invite' });
  expect(test.rows.save).not.toHaveBeenCalled();
});

it('keeps a consumed spectator invitation and prunes expired rows in bounded batches', async () => {
  const entity = Object.assign(new RoomInviteEntity(), {
    id: 'invite',
    roomId: 1,
    fromUserId: 2,
    toUserId: 3,
    createdAt: new Date(10),
    expiresAt: new Date(1_000),
    consumedAt: null,
  });
  const test = fixture(entity);
  await expect(
    test.repository.consume('invite', 100, 50, true),
  ).resolves.toMatchObject({ consumedAt: 100 });
  expect(test.rows.save).toHaveBeenCalledTimes(1);
  await test.repository.deleteExpired(2_000, 50_000);
  expect(test.raw.find).toHaveBeenCalledWith(
    expect.objectContaining({ take: 1_000 }),
  );
});

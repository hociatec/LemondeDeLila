import { DataSource, type EntityManager } from 'typeorm';
import { Room } from '../entities/room.entity';
import { RoomBot } from '../entities/room-bot.entity';
import { RoomParticipant } from '../entities/room-participant.entity';
import { RoomBotsTypeormRepository } from './room-bots-typeorm.repository';

it('locks the owning room before executing a bot mutation in the same transaction', async () => {
  const source = new DataSource({ type: 'mysql' });
  const rooms = source.getRepository(Room);
  const bots = source.getRepository(RoomBot);
  const participants = source.getRepository(RoomParticipant);
  const lock = jest.spyOn(rooms, 'findOne').mockResolvedValue(null);
  const count = jest.spyOn(bots, 'count').mockResolvedValue(2);
  const transaction = jest
    .spyOn(source.manager, 'transaction')
    .mockImplementation(
      async (
        operation: string | ((manager: EntityManager) => Promise<unknown>),
      ) => {
        if (typeof operation !== 'function')
          throw new Error('Expected transaction callback');
        return operation(source.manager);
      },
    );
  const repository = new RoomBotsTypeormRepository(bots, rooms, participants);
  await expect(
    repository.runRoomMutation(42, (scoped) => scoped.countBotsForRoom(42)),
  ).resolves.toBe(2);
  expect(transaction).toHaveBeenCalledTimes(1);
  expect(lock).toHaveBeenCalledWith({
    where: { id: 42 },
    lock: { mode: 'pessimistic_write' },
  });
  expect(count).toHaveBeenCalledWith({ where: { room: { id: 42 } } });
  expect(lock.mock.invocationCallOrder[0]).toBeLessThan(
    count.mock.invocationCallOrder[0],
  );
});

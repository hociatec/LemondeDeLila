import { Room } from '../entities/room.entity';
import { RoomGameRunTypeormReader } from './room-game-run-typeorm.reader';

it('reads only the current run columns without eager relations or cache', async () => {
  const room = Object.assign(new Room(), {
    id: 1,
    gameType: 'game',
    status: 'started',
    runId: 2,
  });
  const findOne = jest.fn(async () => room);
  const reader = new RoomGameRunTypeormReader({ findOne });
  expect(await reader.isCurrent(1, 'game', 2)).toBe(true);
  room.status = 'setup';
  expect(await reader.isCurrent(1, 'game', 2)).toBe(false);
  expect(await reader.isCurrent(1, 'game', 3)).toBe(true);
  expect(findOne).toHaveBeenCalledTimes(3);
  expect(findOne).toHaveBeenCalledWith({
    where: { id: 1 },
    select: { id: true, gameType: true, status: true, runId: true },
    loadEagerRelations: false,
  });
});

it('distinguishes a deleted room from a failed read', async () => {
  const findOne = jest.fn(async (): Promise<Room | null> => null);
  const reader = new RoomGameRunTypeormReader({ findOne });
  expect(await reader.isCurrent(1, 'game', 1)).toBe(false);
  findOne.mockRejectedValueOnce(new Error('database unavailable'));
  await expect(reader.isCurrent(1, 'game', 1)).rejects.toThrow(
    'database unavailable',
  );
});

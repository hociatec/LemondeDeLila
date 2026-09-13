import type { Repository } from 'typeorm';
import type { BusinessClock } from '../../../../../../shared/interfaces/public-api';
import { Room } from '../entities/room.entity';
import { RoomTypeormRepository } from './room-typeorm.repository';

it('loads game-access relations without a nested partial select', async () => {
  const findOne = jest.fn().mockResolvedValue(null);
  const rooms = { findOne } as unknown as Repository<Room>;
  const clock = { now: () => 0 } as BusinessClock;
  const repository = new RoomTypeormRepository(rooms, clock);

  await expect(repository.findByIdWithPayloadRelations(42)).resolves.toBeNull();

  expect(findOne).toHaveBeenCalledWith({
    where: { id: 42 },
    relations: {
      owner: true,
      participants: { user: true },
      bots: true,
    },
  });
  expect(findOne.mock.calls[0][0]).not.toHaveProperty('select');
});

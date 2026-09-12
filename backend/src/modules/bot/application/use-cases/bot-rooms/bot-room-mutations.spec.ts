import type { BotRoomRepository } from '../../ports/bot-room.repository';
import { BotRoomPolicyService } from './bot-room-policy.service';
import { AddBotToRoomService } from './add-bot-to-room.service';

describe('distributed bot room mutations', () => {
  it('performs capacity and creation inside the repository room lock', async () => {
    const order: string[] = [];
    const rooms: BotRoomRepository = {
      runRoomMutation: jest.fn(
        async <T>(
          _roomId: number,
          operation: (repository: BotRoomRepository) => Promise<T>,
        ): Promise<T> => {
          order.push('lock');
          const result: T = await operation(rooms);
          order.push('unlock');
          return result;
        },
      ),
      assessBotMutation: jest.fn(async () => {
        order.push('permission');
        return 'allowed';
      }),
      countActiveHumansForRoom: jest.fn().mockResolvedValue(1),
      listBotsForRoom: jest.fn().mockResolvedValue([]),
      createBot: jest.fn(async () => {
        order.push('create');
        return { id: 8, name: 'Nova' };
      }),
    } as unknown as BotRoomRepository;
    const names = { pickName: jest.fn().mockResolvedValue('Nova') };
    const service = new AddBotToRoomService(
      rooms,
      names as never,
      new BotRoomPolicyService(),
    );

    await expect(service.execute(4, 1)).resolves.toEqual({
      id: 8,
      name: 'Nova',
    });
    expect(order).toEqual(['lock', 'permission', 'create', 'unlock']);
    jest.spyOn(rooms, 'assessBotMutation').mockResolvedValue('owner-required');
    await expect(service.execute(4, 2)).rejects.toMatchObject({
      code: 'BOT_ROOM_OWNER_REQUIRED',
    });
    expect(names.pickName).toHaveBeenCalledTimes(1);
    expect(rooms.createBot).toHaveBeenCalledTimes(1);
  });
});

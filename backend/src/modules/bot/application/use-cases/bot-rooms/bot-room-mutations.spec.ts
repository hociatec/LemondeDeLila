import type { BotRoomRepository } from '../../ports/bot-room.repository';
import { BotRoomPolicyService } from './bot-room-policy.service';
import { AddBotToRoomService } from './add-bot-to-room.service';

describe('distributed bot room mutations', () => {
  it('performs capacity and creation inside the repository room lock', async () => {
    const order: string[] = [];
    const rooms = {
      runRoomMutation: jest.fn(async (_roomId, operation) => {
        order.push('lock');
        const result = await operation();
        order.push('unlock');
        return result;
      }),
      findRoomById: jest.fn(async () => {
        order.push('room');
        return {
          id: 4,
          ownerId: 1,
          maxPlayers: 4,
          status: 'open',
          startedAt: null,
        };
      }),
      countActiveHumansForRoom: jest.fn().mockResolvedValue(1),
      listBotsForRoom: jest.fn().mockResolvedValue([]),
      createBot: jest.fn(async () => {
        order.push('create');
        return { id: 8, name: 'Nova' };
      }),
    };
    const names = { pickName: jest.fn().mockResolvedValue('Nova') };
    const service = new AddBotToRoomService(
      rooms as unknown as BotRoomRepository,
      names as never,
      new BotRoomPolicyService(),
    );

    await expect(service.execute(4, 1)).resolves.toEqual({
      id: 8,
      name: 'Nova',
    });
    expect(order).toEqual(['lock', 'room', 'create', 'unlock']);
  });
});

import { ForbiddenException } from '@nestjs/common';
import { GameWsRoomContextService } from './game-ws-room-context.service';

describe('GameWsRoomContextService transitions', () => {
  const room = {
    id: 4,
    gameType: 'lama',
    status: 'started',
    runId: 7,
    startedAt: new Date(),
  };

  it('delegates reset to the authorized room lifecycle', async () => {
    const rooms = {
      findOne: jest.fn().mockResolvedValue({ ...room }),
      save: jest.fn(),
    };
    const roomGame = {
      resetRoom: jest.fn().mockResolvedValue(undefined),
      startRoom: jest.fn().mockResolvedValue(undefined),
    };
    const service = new GameWsRoomContextService(
      rooms as never,
      roomGame as never,
    );

    await expect(service.transition(4, 'reset', 23)).resolves.toBe('lama');
    expect(roomGame.resetRoom).toHaveBeenCalledWith(4, 23);
    expect(rooms.save).not.toHaveBeenCalled();
  });

  it('propagates the owner authorization failure', async () => {
    const rooms = {
      findOne: jest.fn().mockResolvedValue({ ...room }),
      save: jest.fn(),
    };
    const roomGame = {
      resetRoom: jest
        .fn()
        .mockRejectedValue(new ForbiddenException('Propriétaire requis')),
      startRoom: jest.fn(),
    };
    const service = new GameWsRoomContextService(
      rooms as never,
      roomGame as never,
    );

    await expect(service.transition(4, 'reset', 99)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(rooms.save).not.toHaveBeenCalled();
  });
});

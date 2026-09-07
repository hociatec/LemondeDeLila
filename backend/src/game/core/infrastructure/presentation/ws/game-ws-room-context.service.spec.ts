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
    const roomGame = {
      getRoomPayload: jest.fn().mockResolvedValue({ room }),
      resetRoom: jest.fn().mockResolvedValue(undefined),
      startRoom: jest.fn().mockResolvedValue(undefined),
    };
    const service = new GameWsRoomContextService(roomGame as never);

    await expect(service.transition(4, 'reset', 23)).resolves.toBe('lama');
    expect(roomGame.resetRoom).toHaveBeenCalledWith(4, 23);
  });

  it('delegates preparation of the next run to the room lifecycle', async () => {
    const roomGame = {
      prepareNextRun: jest.fn().mockResolvedValue(undefined),
    };
    const service = new GameWsRoomContextService(roomGame as never);

    await expect(service.prepareNextRun(4)).resolves.toBeUndefined();
    expect(roomGame.prepareNextRun).toHaveBeenCalledWith(4);
  });

  it('propagates the owner authorization failure', async () => {
    const roomGame = {
      getRoomPayload: jest.fn().mockResolvedValue({ room }),
      resetRoom: jest
        .fn()
        .mockRejectedValue(new ForbiddenException('Propriétaire requis')),
      startRoom: jest.fn(),
    };
    const service = new GameWsRoomContextService(roomGame as never);

    await expect(service.transition(4, 'reset', 99)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows writes only for the owner or an active participant', async () => {
    const roomGame = {
      getRoomPayload: jest.fn().mockResolvedValue({
        room: {
          ...room,
          owner: { id: 1 },
          players: [{ id: 2 }],
        },
      }),
    };
    const service = new GameWsRoomContextService(roomGame as never);

    await expect(service.ensureWritable(4, 1)).resolves.toBeUndefined();
    await expect(service.ensureWritable(4, 2)).resolves.toBeUndefined();
    await expect(service.ensureWritable(4, 3)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});

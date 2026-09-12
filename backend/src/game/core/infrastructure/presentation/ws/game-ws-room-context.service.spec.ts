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

  it('requests an authoritative room payload for game initialization', async () => {
    const payload = { room };
    const roomGame = {
      refreshRoomPayload: jest.fn().mockResolvedValue(payload),
    };
    const service = new GameWsRoomContextService(roomGame as never);

    await expect(service.refreshPayload(4)).resolves.toBe(payload);
    expect(roomGame.refreshRoomPayload).toHaveBeenCalledWith(4);
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

  it('delegates authorization without reading a cached payload', async () => {
    const authorizeGameAccess = jest.fn().mockResolvedValue(undefined);
    const roomGame = {
      authorizeGameAccess,
      getRoomPayload: jest.fn(),
      refreshRoomPayload: jest.fn(),
      resetRoom: jest.fn(),
      startRoom: jest.fn(),
      prepareNextRun: jest.fn(),
    };
    const service = new GameWsRoomContextService(roomGame);
    await service.ensureReadable(4, 2);
    await service.ensureWritable(4, 2);
    expect(authorizeGameAccess).toHaveBeenNthCalledWith(1, 4, 2, 'read');
    expect(authorizeGameAccess).toHaveBeenNthCalledWith(2, 4, 2, 'write');
    expect(roomGame.getRoomPayload).not.toHaveBeenCalled();
    authorizeGameAccess.mockRejectedValueOnce(new ForbiddenException());
    await expect(service.ensureWritable(4, 3)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});

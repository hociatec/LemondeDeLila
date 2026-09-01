import {
  baseRoomPayload,
  createGatewayFixture,
  createSocket,
} from './tests/room.gateway.fixture';

describe('RoomGateway lifecycle scenarios', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a room, sends room.created, caches payload, and broadcasts room payload', async () => {
    const { gateway, deps } = createGatewayFixture();
    const socket = createSocket();
    const meta = {
      socket,
      userId: 1,
      username: 'owner',
      roomId: 0,
      role: 'spectator',
      silent: false,
      isAdmin: false,
    };

    await gateway.handleRoomCreate(
      socket,
      meta,
      {
        gameType: 'lama',
        name: 'Ma table',
        maxPlayers: 5,
        isPrivate: false,
      },
      Date.now(),
    );

    expect(deps.roomsService.createRoom).toHaveBeenCalledWith(
      1,
      'lama',
      'Ma table',
      5,
      false,
      false,
    );
    expect(meta.roomId).toBe(10);
    expect(meta.role).toBe('participant');
    expect(deps.roomsService.primeRoomPayloadCache).toHaveBeenCalled();
    expect(gateway.broadcastRoomPayload).toHaveBeenCalled();

    const primed = deps.roomsService.primeRoomPayloadCache.mock.calls[0][1];
    expect(primed.room).toMatchObject({
      id: 10,
      status: 'setup',
      startedAt: null,
      runId: 0,
      tableAmbienceSoundId: null,
    });

    const sent = socket.send.mock.calls.map((call: any[]) =>
      JSON.parse(String(call[0])),
    );
    expect(
      sent.some(
        (m: any) =>
          m.type === 'room.created' &&
          m.payload?.room?.runId === 0 &&
          m.payload?.room?.startedAt === null,
      ),
    ).toBe(true);
  });

  it('join: rejects banned users with sendError', async () => {
    const { gateway, deps } = createGatewayFixture();
    const socket = createSocket();
    const meta = {
      socket,
      userId: 7,
      username: 'user',
      roomId: 0,
      role: 'spectator',
      silent: false,
      isAdmin: false,
    };
    deps.roomsService.isBanned.mockReturnValue(true);

    await gateway.handleRoomJoin(
      socket,
      meta,
      { roomId: 10, spectator: false },
      Date.now(),
    );

    expect(gateway.sendError).toHaveBeenCalledWith(
      socket,
      'Banni de cette table.',
    );
    expect(deps.roomsService.joinRoom).not.toHaveBeenCalled();
  });

  it('join: rejects silent mode for non-admin', async () => {
    const { gateway, deps } = createGatewayFixture();
    const socket = createSocket();
    const meta = {
      socket,
      userId: 7,
      username: 'user',
      roomId: 0,
      role: 'spectator',
      silent: false,
      isAdmin: false,
    };

    await gateway.handleRoomJoin(
      socket,
      meta,
      { roomId: 10, hidden: true },
      Date.now(),
    );

    expect(socket.close).toHaveBeenCalledWith(
      4003,
      'Mode caché réservé aux admins',
    );
    expect(deps.roomsService.joinRoom).not.toHaveBeenCalled();
  });

  it('join: rejects explicit spectate when canSpectate=false', async () => {
    const { gateway, deps } = createGatewayFixture();
    const socket = createSocket();
    const meta = {
      socket,
      userId: 7,
      username: 'user',
      roomId: 0,
      role: 'spectator',
      silent: false,
      isAdmin: false,
    };
    gateway.canSpectate.mockResolvedValueOnce(false);

    await gateway.handleRoomJoin(
      socket,
      meta,
      { roomId: 10, spectator: true },
      Date.now(),
    );

    expect(socket.close).toHaveBeenCalledWith(
      4003,
      'Spectateur non autorise sur cette table',
    );
    expect(deps.roomsService.joinRoom).not.toHaveBeenCalled();
  });

  it('join: allows silent admin and sends private state to the joining socket', async () => {
    const { gateway, deps } = createGatewayFixture();
    const socket = createSocket();
    const meta = {
      socket,
      userId: 99,
      username: 'admin',
      roomId: 0,
      role: 'spectator',
      silent: false,
      isAdmin: true,
    };

    await gateway.handleRoomJoin(
      socket,
      meta,
      { roomId: 10, hidden: true },
      Date.now(),
    );

    expect(meta.silent).toBe(true);
    expect(meta.role).toBe('spectator');
    expect(gateway.sendRoomStateToClient).toHaveBeenCalledWith(
      socket,
      10,
      expect.objectContaining({
        includeRealtimePlayers: true,
      }),
    );
    expect(deps.roomsService.joinRoom).not.toHaveBeenCalled();
  });

  it('join: falls back to spectator when room already started and spectate is allowed', async () => {
    const { gateway, deps } = createGatewayFixture();
    const socket = createSocket();
    const meta = {
      socket,
      userId: 9,
      username: 'viewer',
      roomId: 0,
      role: 'spectator',
      silent: false,
      isAdmin: false,
    };

    deps.roomsService.joinRoom.mockRejectedValueOnce(
      new Error('Table déjà démarrée'),
    );
    deps.roomsService.getRoomPayload.mockResolvedValueOnce(
      baseRoomPayload({
        room: {
          status: 'started',
          startedAt: '2026-03-02T12:00:00.000Z',
          owner: { id: 1, username: 'owner' },
          players: [{ id: 1, username: 'owner' }],
        },
      }),
    );
    gateway.canSpectate.mockResolvedValueOnce(true);

    await gateway.handleRoomJoin(
      socket,
      meta,
      { roomId: 10, spectator: false },
      Date.now(),
    );

    expect(meta.role).toBe('spectator');
    expect(gateway.sendRoomState).toHaveBeenCalledWith(10);
  });

  it('join: requires an invitation when started-room spectate is denied', async () => {
    const { gateway, deps } = createGatewayFixture();
    const socket = createSocket();
    const meta = {
      socket,
      userId: 9,
      username: 'viewer',
      roomId: 0,
      role: 'spectator',
      silent: false,
      isAdmin: false,
    };

    deps.roomsService.joinRoom.mockRejectedValueOnce(
      new Error('Table déjà démarrée'),
    );
    deps.roomsService.getRoomPayload.mockResolvedValueOnce(
      baseRoomPayload({
        room: { status: 'started', startedAt: '2026-03-02T12:00:00.000Z' },
      }),
    );
    gateway.canSpectate.mockResolvedValueOnce(false);

    await expect(
      gateway.handleRoomJoin(
        socket,
        meta,
        { roomId: 10, spectator: false },
        Date.now(),
      ),
    ).rejects.toThrow('Table privée: invitation requise');
  });
});

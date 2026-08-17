import { RoomGateway } from './room.gateway';

type GatewayFixture = {
  gateway: any;
  deps: {
    roomsService: any;
    botService: any;
    auth: any;
    catalog: any;
    perf: any;
    invites: any;
    clientUpdates: any;
    wsTickets: any;
    realtimeTracker: any;
    sounds: any;
  };
};

function createSocket() {
  return {
    readyState: 1,
    send: jest.fn((_message: any, cb?: (...args: any[]) => void) => {
      if (typeof cb === 'function') cb();
    }),
    close: jest.fn(),
  } as any;
}

function baseRoomPayload(overrides?: Partial<any>): any {
  const payload = {
    manifest: {
      id: 'lama',
      name: 'Lama',
      minPlayers: 2,
      maxPlayers: 6,
      chatEnabled: true,
      chatSoundsEnabled: true,
    },
    room: {
      id: 10,
      name: 'Table test',
      isPrivate: false,
      maxPlayers: 6,
      status: 'setup',
      gameType: 'lama',
      startedAt: null,
      counts: { players: 1, spectators: 0 },
      owner: { id: 1, username: 'owner' },
      players: [{ id: 1, username: 'owner' }],
      spectators: [],
      bots: [],
      runId: null,
      tableAmbienceSoundId: null,
    },
    generatedAt: new Date().toISOString(),
  };

  if (!overrides) return payload;
  return {
    ...payload,
    ...overrides,
    room: {
      ...payload.room,
      ...(overrides.room ?? {}),
    },
    manifest: {
      ...payload.manifest,
      ...(overrides.manifest ?? {}),
    },
  };
}

function createGatewayFixture(): GatewayFixture {
  const roomsService: any = {
    setRealtimeNotifier: jest.fn(),
    setRoomDeletedNotifier: jest.fn(),
    createRoom: jest.fn().mockResolvedValue({
      id: 10,
      name: 'Table test',
      isPrivate: false,
      maxPlayers: 6,
      status: 'setup',
      gameType: 'lama',
      startedAt: null,
      runId: null,
    }),
    joinRoom: jest.fn().mockResolvedValue({ id: 10 }),
    leaveRoom: jest.fn().mockResolvedValue({ id: 10 }),
    startRoom: jest.fn().mockResolvedValue({
      id: 10,
      status: 'started',
      startedAt: new Date('2026-03-02T12:00:00.000Z'),
      runId: 3,
    }),
    getRoomPayload: jest.fn().mockResolvedValue(baseRoomPayload()),
    isBanned: jest.fn().mockReturnValue(false),
    invalidateRoomPayloadCache: jest.fn().mockResolvedValue(undefined),
    primeRoomPayloadCache: jest.fn().mockResolvedValue(undefined),
    updateRoomPayloadCache: jest
      .fn()
      .mockResolvedValue(baseRoomPayload({ room: { isPrivate: true } })),
    togglePrivacy: jest.fn().mockResolvedValue({ id: 10, isPrivate: true }),
    requireRoomForOwnerAction: jest.fn().mockResolvedValue({ id: 10 }),
    saveRoom: jest.fn().mockResolvedValue(undefined),
    transferOwnerIfCurrent: jest.fn().mockResolvedValue(undefined),
    resetRoom: jest.fn().mockResolvedValue({ id: 10 }),
  };

  const botService: any = {
    addBot: jest.fn(),
    removeBot: jest.fn(),
    getLastBotForRoom: jest.fn(),
  };
  const auth: any = {};
  const catalog: any = {
    getGame: jest.fn().mockResolvedValue({
      id: 'lama',
      name: 'Lama',
      minPlayers: 2,
      maxPlayers: 6,
      chatEnabled: true,
      chatSoundsEnabled: true,
    }),
  };
  const perf: any = {
    measure: jest
      .fn()
      .mockImplementation(async (_metric: string, fn: any) => await fn()),
  };
  const invites: any = {
    canSpectate: jest.fn().mockReturnValue(true),
  };
  const clientUpdates: any = {
    getMinRequiredVersion: jest.fn().mockResolvedValue(null),
  };
  const wsTickets: any = {
    validate: jest.fn().mockReturnValue(true),
  };
  const realtimeTracker: any = {
    setSocketParticipantRoom: jest.fn(),
    clearSocket: jest.fn(),
  };
  const sounds: any = {
    listTableAmbiencesWithFilter: jest.fn().mockResolvedValue({ items: [] }),
  };

  const gateway = new RoomGateway(
    roomsService,
    botService,
    auth,
    catalog,
    perf,
    invites,
    clientUpdates,
    wsTickets,
    realtimeTracker,
    sounds,
  ) as any;

  gateway.broadcastRoomPayload = jest.fn().mockResolvedValue(undefined);
  gateway.broadcastRoomIntent = jest.fn().mockResolvedValue(undefined);
  gateway.broadcast = jest.fn().mockResolvedValue(undefined);
  gateway.sendRoomState = jest.fn().mockResolvedValue(undefined);
  gateway.sendRoomStateToClient = jest.fn().mockResolvedValue(undefined);
  gateway.sendError = jest.fn().mockResolvedValue(undefined);
  gateway.leavePreviousRoomOnSwitch = jest.fn().mockResolvedValue(undefined);
  gateway.tryUpdateRoomPayload = jest.fn().mockResolvedValue(true);
  gateway.canSpectate = jest.fn().mockResolvedValue(true);
  gateway.withAllowedActionsForClient = jest.fn((payload: any) => payload);

  return {
    gateway,
    deps: {
      roomsService,
      botService,
      auth,
      catalog,
      perf,
      invites,
      clientUpdates,
      wsTickets,
      realtimeTracker,
      sounds,
    },
  };
}

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

    const sent = socket.send.mock.calls.map((call: any[]) =>
      JSON.parse(String(call[0])),
    );
    expect(sent.some((m: any) => m.type === 'room.created')).toBe(true);
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
      { roomId: 10, silent: true },
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
      { roomId: 10, silent: true },
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

  it('join: throws when room started and spectate is denied', async () => {
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
    ).rejects.toThrow('Table déjà démarrée');
  });

  it('set role: rejects role change when game already started', async () => {
    const { gateway, deps } = createGatewayFixture();
    const socket = createSocket();
    const meta = {
      socket,
      userId: 1,
      username: 'owner',
      roomId: 10,
      role: 'participant',
      silent: false,
      isAdmin: false,
    };
    deps.roomsService.getRoomPayload.mockResolvedValueOnce(
      baseRoomPayload({
        room: { status: 'started', startedAt: '2026-03-02T12:00:00.000Z' },
      }),
    );

    await expect(gateway.handleSetRole(socket, meta, {})).rejects.toThrow(
      'Partie déjà commencée',
    );
  });

  it('set role: toggles participant -> spectator in public room', async () => {
    const { gateway, deps } = createGatewayFixture();
    const socket = createSocket();
    const meta = {
      socket,
      userId: 1,
      username: 'owner',
      roomId: 10,
      role: 'participant',
      silent: false,
      isAdmin: false,
    };
    deps.roomsService.getRoomPayload.mockResolvedValueOnce(
      baseRoomPayload({
        room: {
          isPrivate: false,
          status: 'setup',
          owner: { id: 1, username: 'owner' },
        },
      }),
    );

    await gateway.handleSetRole(socket, meta, {});

    expect(deps.roomsService.leaveRoom).toHaveBeenCalledWith(
      10,
      1,
      expect.objectContaining({ preserveRoom: true, preserveOwner: true }),
    );
    expect(meta.role).toBe('spectator');
    expect(gateway.sendRoomState).toHaveBeenCalledWith(10);

    const sent = socket.send.mock.calls.map((call: any[]) =>
      JSON.parse(String(call[0])),
    );
    expect(
      sent.some(
        (m: any) => m.type === 'room.role' && m.payload?.spectator === true,
      ),
    ).toBe(true);
  });

  it('set role: private room requires invitation for non-owner/non-participant', async () => {
    const { gateway, deps } = createGatewayFixture();
    const socket = createSocket();
    const meta = {
      socket,
      userId: 7,
      username: 'user',
      roomId: 10,
      role: 'spectator',
      silent: false,
      isAdmin: false,
    };
    deps.roomsService.getRoomPayload.mockResolvedValueOnce(
      baseRoomPayload({
        room: {
          isPrivate: true,
          status: 'setup',
          owner: { id: 1, username: 'owner' },
          players: [{ id: 1, username: 'owner' }],
        },
      }),
    );

    await expect(
      gateway.handleSetRole(socket, meta, { spectator: false }),
    ).rejects.toThrow('Table privée: invitation requise');
  });

  it('set role: private room allows owner to become participant', async () => {
    const { gateway, deps } = createGatewayFixture();
    const socket = createSocket();
    const meta = {
      socket,
      userId: 1,
      username: 'owner',
      roomId: 10,
      role: 'spectator',
      silent: false,
      isAdmin: false,
    };
    deps.roomsService.getRoomPayload.mockResolvedValueOnce(
      baseRoomPayload({
        room: {
          isPrivate: true,
          status: 'setup',
          owner: { id: 1, username: 'owner' },
        },
      }),
    );

    await gateway.handleSetRole(socket, meta, { spectator: false });

    expect(deps.roomsService.joinRoom).toHaveBeenCalledWith(10, 1, {
      allowPrivate: true,
    });
    expect(meta.role).toBe('participant');
  });

  it('start room: updates cached payload on success path', async () => {
    const { gateway, deps } = createGatewayFixture();
    await gateway.handleRoomStart(
      { roomId: 10, userId: 1 } as any,
      {},
      Date.now(),
    );

    expect(deps.roomsService.startRoom).toHaveBeenCalledWith(10, 1, false);
    expect(gateway.broadcast).toHaveBeenCalledWith(10, 'state-updated', {
      roomId: 10,
    });
    expect(gateway.tryUpdateRoomPayload).toHaveBeenCalled();
    expect(gateway.sendRoomState).not.toHaveBeenCalled();
  });

  it('start room: falls back to invalidate+send state when cache update misses', async () => {
    const { gateway, deps } = createGatewayFixture();
    gateway.tryUpdateRoomPayload.mockResolvedValueOnce(false);

    await gateway.handleRoomStart(
      { roomId: 10, userId: 1 } as any,
      {},
      Date.now(),
    );

    expect(deps.roomsService.invalidateRoomPayloadCache).toHaveBeenCalledWith(
      10,
    );
    expect(gateway.sendRoomState).toHaveBeenCalledWith(10);
  });

  it('toggle privacy: broadcasts privacy state and announcement', async () => {
    const { gateway, deps } = createGatewayFixture();
    deps.roomsService.updateRoomPayloadCache.mockResolvedValueOnce(
      baseRoomPayload({ room: { isPrivate: true } }),
    );

    await gateway.handleTogglePrivacy(
      { roomId: 10, userId: 1 } as any,
      {},
      Date.now(),
    );

    expect(deps.roomsService.togglePrivacy).toHaveBeenCalledWith(10, 1, false);
    expect(gateway.broadcast).toHaveBeenCalledWith(
      10,
      'room.privacy',
      expect.objectContaining({ isPrivate: true }),
    );
    expect(gateway.broadcastRoomIntent).toHaveBeenCalledWith(
      10,
      expect.objectContaining({
        type: 'announcement',
      }),
    );
  });

  it('toggle privacy: falls back to getRoomPayload when cache update misses', async () => {
    const { gateway, deps } = createGatewayFixture();
    deps.roomsService.updateRoomPayloadCache.mockResolvedValueOnce(null);
    deps.roomsService.getRoomPayload.mockResolvedValueOnce(
      baseRoomPayload({ room: { isPrivate: false } }),
    );

    await gateway.handleTogglePrivacy(
      { roomId: 10, userId: 1 } as any,
      {},
      Date.now(),
    );

    expect(deps.roomsService.invalidateRoomPayloadCache).toHaveBeenCalledWith(
      10,
    );
    expect(deps.roomsService.getRoomPayload).toHaveBeenCalledWith(10);
    expect(gateway.broadcast).toHaveBeenCalledWith(
      10,
      'room.privacy',
      expect.objectContaining({ isPrivate: false }),
    );
  });

  it('delayed participant leave disables replacement bot after a disconnect grace timeout', () => {
    jest.useFakeTimers();
    try {
      const { gateway, deps } = createGatewayFixture();

      gateway.sendRoomState = jest.fn().mockResolvedValue(undefined);
      gateway.hasUserConnections = jest.fn().mockReturnValue(false);

      gateway.scheduleDelayedParticipantLeave(10, 3);
      jest.runOnlyPendingTimers();

      expect(deps.roomsService.leaveRoom).toHaveBeenCalledWith(
        10,
        3,
        expect.objectContaining({
          preserveRoom: false,
          disconnectOnly: false,
          replaceWithBot: false,
        }),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('immediate ack: emits room.ack only for immediate actions', () => {
    const { gateway } = createGatewayFixture();
    const socket = createSocket();
    const meta = { roomId: 10 };
    const sentAtMs = Date.now() - 50;
    const receivedAtMs = Date.now();

    gateway.sendImmediateAckIfNeeded(
      socket,
      meta,
      'room.start',
      { _trace: { id: 'trace-1', sentAtMs } },
      receivedAtMs,
    );
    gateway.sendImmediateAckIfNeeded(
      socket,
      meta,
      'room.chat.send',
      { _trace: { id: 'trace-2', sentAtMs } },
      receivedAtMs,
    );

    const sent = socket.send.mock.calls.map((call: any[]) =>
      JSON.parse(String(call[0])),
    );
    expect(sent.filter((m: any) => m.type === 'room.ack')).toHaveLength(1);
    expect(sent[0].payload.action).toBe('room.start');
    expect(sent[0].payload.traceId).toBe('trace-1');
  });

  it('legacy dispatcher routes room.start and room.create actions', async () => {
    const { gateway } = createGatewayFixture();
    const socket = createSocket();
    const meta = {
      socket,
      roomId: 10,
      userId: 1,
      username: 'owner',
      role: 'participant',
      silent: false,
      isAdmin: false,
    };

    const startSpy = jest
      .spyOn(gateway, 'handleRoomStart')
      .mockResolvedValue(undefined);
    const createSpy = jest
      .spyOn(gateway, 'handleRoomCreate')
      .mockResolvedValue(undefined);

    await gateway.executeLegacyRoomCommand(
      socket,
      meta,
      'room.start',
      { foo: 'bar' },
      Date.now(),
    );
    await gateway.executeLegacyRoomCommand(
      socket,
      meta,
      'room.create',
      { gameType: 'lama' },
      Date.now(),
    );

    expect(startSpy).toHaveBeenCalled();
    expect(createSpy).toHaveBeenCalled();
  });

  it('room.intent.execute maps alias room.toggle-role to room.set-role', async () => {
    const { gateway } = createGatewayFixture();
    const socket = createSocket();
    const meta = {
      socket,
      roomId: 10,
      userId: 1,
      username: 'owner',
      role: 'participant',
      silent: false,
      isAdmin: false,
    };

    const execSpy = jest
      .spyOn(gateway, 'executeLegacyRoomCommand')
      .mockResolvedValue(undefined);
    const ackSpy = jest
      .spyOn(gateway, 'sendImmediateAckIfNeeded')
      .mockImplementation(() => undefined);

    await gateway.handleRoomIntentExecute(
      socket,
      meta,
      {
        intentId: 'room.toggle-role',
        payload: { spectator: true },
      },
      Date.now(),
    );

    expect(ackSpy).toHaveBeenCalledWith(
      socket,
      meta,
      'room.set-role',
      expect.objectContaining({ spectator: true }),
      expect.any(Number),
    );
    expect(execSpy).toHaveBeenCalledWith(
      socket,
      meta,
      'room.set-role',
      expect.objectContaining({ spectator: true }),
      expect.any(Number),
    );
  });
});

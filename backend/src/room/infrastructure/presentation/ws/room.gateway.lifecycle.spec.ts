import { RoomGatewayActionsService } from './room-gateway-actions.service';
import { RoomGatewayBotActionsService } from './room-gateway-bot-actions.service';
import { RoomGatewayCommandService } from './room-gateway-command.service';
import { RoomGatewayLifecycleService } from './room-gateway-lifecycle.service';
import { RoomGatewayLifecyclePresenter } from './room-gateway-lifecycle.presenter';
import { RoomGatewayPresenceService } from './room-gateway-presence.service';
import { RoomJoinPolicyService } from '../../../application/services/room-join-policy.service';
import { RoomAdminPolicyService } from '../../../application/services/room-admin-policy.service';
import { RoomGatewayPresenter } from './room-gateway.presenter';

type GatewayFixture = {
  gateway: any;
  deps: {
    roomsService: any;
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
  const roomState: any = {
    getRoomPayload: roomsService.getRoomPayload,
    isBanned: roomsService.isBanned,
    invalidateRoomPayloadCache: roomsService.invalidateRoomPayloadCache,
    primeRoomPayloadCache: roomsService.primeRoomPayloadCache,
    updateRoomPayloadCache: roomsService.updateRoomPayloadCache,
    notifyRoomStateUpdated: jest.fn().mockResolvedValue(undefined),
  };

  const addBotToRoom: any = { execute: jest.fn() };
  const getLastRoomBot: any = { execute: jest.fn() };
  const removeBotFromRoom: any = { execute: jest.fn() };
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
  const realtimeTracker: any = {
    setSocketParticipantRoom: jest.fn(),
    clearSocket: jest.fn(),
  };
  const joinPolicy = new RoomJoinPolicyService();
  const lifecyclePresenter = new RoomGatewayLifecyclePresenter();
  const adminPolicy = new RoomAdminPolicyService();
  const gatewayPresenter = new RoomGatewayPresenter();
  const lifecycle = new RoomGatewayLifecycleService(
    roomsService,
    roomsService,
    roomState,
    catalog,
    perf,
    realtimeTracker,
    joinPolicy,
    lifecyclePresenter,
  ) as any;
  const botActions = new RoomGatewayBotActionsService(
    addBotToRoom,
    getLastRoomBot,
    removeBotFromRoom,
    perf,
    roomState,
    gatewayPresenter,
  ) as any;
  const actions = new RoomGatewayActionsService(
    roomsService,
    roomsService,
    roomState,
    adminPolicy,
    perf,
    realtimeTracker,
    gatewayPresenter,
    botActions,
  ) as any;
  const commands = new RoomGatewayCommandService() as any;
  const presence = new RoomGatewayPresenceService(
    roomsService,
    roomState,
  ) as any;
  const clients = new Map();
  const rooms = new Map();
  const silentRooms = new Map();
  const pendingParticipantLeaves = new Map();
  const gateway: any = {
    broadcastRoomPayload: jest.fn().mockResolvedValue(undefined),
    broadcastRoomIntent: jest.fn().mockResolvedValue(undefined),
    broadcast: jest.fn().mockResolvedValue(undefined),
    sendRoomState: jest.fn().mockResolvedValue(undefined),
    sendRoomStateToClient: jest.fn().mockResolvedValue(undefined),
    sendError: jest.fn().mockResolvedValue(undefined),
    leavePreviousRoomOnSwitch: jest.fn().mockResolvedValue(undefined),
    tryUpdateRoomPayload: jest.fn().mockResolvedValue(true),
    canSpectate: jest.fn().mockResolvedValue(true),
    withAllowedActionsForClient: jest.fn((payload: any) => payload),
  };
  const asRecord = (value: unknown): Record<string, unknown> =>
    value != null && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  const safeSend = (client: any, payload: unknown): void => {
    if (client.readyState === 1) client.send(JSON.stringify(payload));
  };
  const lifecycleContext = () => ({
    server: {} as any,
    rooms,
    silentRooms,
    clients,
    sendRoomLeftOrDeleted: jest.fn().mockResolvedValue(undefined),
    resetClientRoomState: jest.fn(),
    hasUserConnections: (roomId: number, userId: number) =>
      presence.hasUserConnections(presenceContext(), roomId, userId),
    sendRoomState: (...args: any[]) => gateway.sendRoomState(...args),
    sendRoomStateToClient: (...args: any[]) =>
      gateway.sendRoomStateToClient(...args),
    broadcast: (...args: any[]) => gateway.broadcast(...args),
    broadcastRoomIntent: (...args: any[]) =>
      gateway.broadcastRoomIntent(...args),
    broadcastRoomPayload: (...args: any[]) =>
      gateway.broadcastRoomPayload(...args),
    sendError: (...args: any[]) => gateway.sendError(...args),
    safeSend,
    tryUpdateRoomPayload: (...args: any[]) =>
      gateway.tryUpdateRoomPayload(...args),
    canSpectate: (...args: any[]) => gateway.canSpectate(...args),
    leavePreviousRoomOnSwitch: (...args: any[]) =>
      gateway.leavePreviousRoomOnSwitch(...args),
    withAllowedActionsForClient: (...args: any[]) =>
      gateway.withAllowedActionsForClient(...args),
    asRecord,
  });
  const presenceContext = (): any => ({
    clients,
    rooms,
    silentRooms,
    pendingParticipantLeaves,
    participantDisconnectGraceMs: 60_000,
    clearRealtimeSocket: jest.fn(),
    stopHeartbeat: jest.fn(),
    deleteMessageQueue: jest.fn(),
    sendRoomState: (...args: any[]) => gateway.sendRoomState(...args),
    resetClientRoomState: jest.fn(),
    sendRoomLeftOrDeleted: jest.fn().mockResolvedValue(undefined),
    sendRoomError: jest.fn(),
  });
  const actionsContext = () => ({
    server: {} as any,
    rooms,
    silentRooms,
    clients,
    broadcast: (...args: any[]) => gateway.broadcast(...args),
    broadcastRoomIntent: (...args: any[]) =>
      gateway.broadcastRoomIntent(...args),
    sendRoomState: (...args: any[]) => gateway.sendRoomState(...args),
    tryUpdateRoomPayload: (...args: any[]) =>
      gateway.tryUpdateRoomPayload(...args),
    sendError: (...args: any[]) => gateway.sendError(...args),
    safeSend,
    sendRoomError: jest.fn(),
    sendRoomLeftOrDeleted: jest.fn().mockResolvedValue(undefined),
    hasUserConnections: (roomId: number, userId: number) =>
      presence.hasUserConnections(presenceContext(), roomId, userId),
    resetClientRoomState: jest.fn(),
    asRecord,
  });
  const commandContext = (): any => ({
    safeSend,
    asRecord,
    sendImmediateAckIfNeeded: (...args: any[]) =>
      gateway.sendImmediateAckIfNeeded(...args),
    executeLegacyRoomCommand: (...args: any[]) =>
      gateway.executeLegacyRoomCommand(...args),
    handleRoomLeave: jest.fn().mockResolvedValue(undefined),
    handleChatSend: jest.fn().mockResolvedValue(undefined),
    handleChatHistory: jest.fn().mockResolvedValue(undefined),
    handleRoomStart: (...args: any[]) => gateway.handleRoomStart(...args),
    handleRoomReset: jest.fn().mockResolvedValue(undefined),
    handleSetRole: (...args: any[]) => gateway.handleSetRole(...args),
    handleKickOrBan: jest.fn().mockResolvedValue(undefined),
    handleSetOwner: jest.fn().mockResolvedValue(undefined),
    handleSetAmbience: jest.fn().mockResolvedValue(undefined),
    handleTogglePrivacy: (...args: any[]) =>
      gateway.handleTogglePrivacy(...args),
    handleRoomInfo: jest.fn().mockResolvedValue(undefined),
    handleBotAdd: jest.fn().mockResolvedValue(undefined),
    handleBotRemove: jest.fn().mockResolvedValue(undefined),
    handleRoomCreate: (...args: any[]) => gateway.handleRoomCreate(...args),
    handleRoomJoin: (...args: any[]) => gateway.handleRoomJoin(...args),
  });
  gateway.handleRoomCreate = (...args: any[]) =>
    lifecycle.handleRoomCreate(lifecycleContext(), ...args);
  gateway.handleRoomJoin = (...args: any[]) =>
    lifecycle.handleRoomJoin(lifecycleContext(), ...args);
  gateway.handleRoomStart = (...args: any[]) =>
    lifecycle.handleRoomStart(lifecycleContext(), ...args);
  gateway.handleTogglePrivacy = (...args: any[]) =>
    lifecycle.handleTogglePrivacy(lifecycleContext(), ...args);
  gateway.handleSetRole = (...args: any[]) =>
    actions.handleSetRole(actionsContext(), ...args);
  gateway.hasUserConnections = (roomId: number, userId: number) =>
    presence.hasUserConnections(presenceContext(), roomId, userId);
  gateway.scheduleDelayedParticipantLeave = (roomId: number, userId: number) =>
    presence.scheduleDelayedParticipantLeave(presenceContext(), roomId, userId);
  gateway.sendImmediateAckIfNeeded = (...args: any[]) =>
    commands.sendImmediateAckIfNeeded(commandContext(), ...args);
  gateway.executeLegacyRoomCommand = (...args: any[]) =>
    commands.executeLegacyRoomCommand(commandContext(), ...args);
  gateway.handleRoomIntentExecute = (...args: any[]) =>
    commands.handleRoomIntentExecute(commandContext(), ...args);

  return {
    gateway,
    deps: { roomsService },
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
        payload: { message: 'Table privée.' },
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

import { Room } from '../entities/room.entity';
import { RoomParticipant } from '../entities/room-participant.entity';
import { RoomService } from './room.service';

type Fixture = {
  service: RoomService;
  deps: {
    rooms: any;
    participants: any;
    vaultSnapshots: any;
    users: any;
    botService: any;
    presence: any;
    catalog: any;
    stats: any;
    tracker: any;
    config: any;
    redisFactory: any;
    txRoomRepo: any;
    txParticipantRepo: any;
  };
  usersById: Map<number, any>;
  roomsById: Map<number, any>;
};

function buildUser(
  id: number,
  username: string,
  roles: string[] = [],
): Record<string, any> {
  return { id, username, roles };
}

function buildRoom(overrides?: Partial<any>): any {
  return {
    id: 10,
    name: 'Table test',
    gameType: 'lama',
    maxPlayers: 4,
    isPrivate: false,
    status: 'setup',
    owner: buildUser(1, 'owner'),
    createdAt: new Date('2026-03-02T10:00:00.000Z'),
    startedAt: null,
    runId: 0,
    participants: [],
    bots: [],
    ...(overrides ?? {}),
  };
}

function createFixture(): Fixture {
  const usersById = new Map<number, any>();
  const roomsById = new Map<number, any>();

  const txRoomRepo = {
    create: jest.fn((data: any) => ({ ...data })),
    save: jest.fn(async (room: any) => {
      if (!room.id) room.id = 10;
      return room;
    }),
  };
  const txParticipantRepo = {
    create: jest.fn((data: any) => ({ ...data })),
    save: jest.fn(async (participant: any) => participant),
  };

  const rooms = {
    findOne: jest.fn(async (opts: any) => {
      const id = Number(opts?.where?.id ?? 0);
      return roomsById.get(id) ?? null;
    }),
    save: jest.fn(async (room: any) => {
      if (room?.id) {
        roomsById.set(room.id, room);
      }
      return room;
    }),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
    manager: {
      transaction: jest.fn(async (callback: any) => {
        return callback({
          getRepository: (entity: any) => {
            if (entity === Room) return txRoomRepo;
            if (entity === RoomParticipant) return txParticipantRepo;
            throw new Error(`Unexpected repository: ${String(entity)}`);
          },
        });
      }),
    },
    createQueryBuilder: jest.fn(),
  } as any;

  const participants = {
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn((data: any) => ({ ...data })),
    save: jest.fn(async (participant: any) => participant),
    createQueryBuilder: jest.fn(),
  } as any;

  const vaultSnapshots = {
    delete: jest.fn().mockResolvedValue(undefined),
  } as any;

  const users = {
    findOne: jest.fn(async (opts: any) => {
      const id = Number(opts?.where?.id ?? 0);
      return usersById.get(id) ?? null;
    }),
  } as any;

  const botService = {
    countBotsForRoom: jest.fn().mockResolvedValue(0),
    addBotSystem: jest.fn().mockResolvedValue(undefined),
    removeAllBotsForRoom: jest.fn().mockResolvedValue(undefined),
  } as any;

  const presence = {
    broadcastPresence: jest.fn(),
  } as any;

  const catalog = {
    getGame: jest.fn().mockResolvedValue({
      id: 'lama',
      name: 'Lama',
      minPlayers: 2,
      maxPlayers: 4,
      status: 'published',
      chatEnabled: true,
      chatSoundsEnabled: true,
    }),
  } as any;

  const stats = {
    markQuit: jest.fn().mockResolvedValue(undefined),
    startMatch: jest.fn().mockResolvedValue(undefined),
    endMatchOnReset: jest.fn().mockResolvedValue(undefined),
  } as any;

  const tracker = {
    hasActivePlayers: jest.fn().mockReturnValue(false),
    countActivePlayers: jest.fn().mockReturnValue(0),
  } as any;

  const config = {
    get: jest.fn((key: string) => {
      if (key === 'ROOM_PAYLOAD_CACHE_TTL_SECONDS') return 15;
      if (key === 'RESTORED_ROOM_GRACE_MS') return 180_000;
      return null;
    }),
  } as any;

  const redisFactory = {
    create: jest.fn(),
  } as any;

  const service = new RoomService(
    rooms,
    participants,
    vaultSnapshots,
    users,
    botService,
    presence,
    catalog,
    stats,
    tracker,
    config,
    redisFactory,
  );

  return {
    service,
    deps: {
      rooms,
      participants,
      vaultSnapshots,
      users,
      botService,
      presence,
      catalog,
      stats,
      tracker,
      config,
      redisFactory,
      txRoomRepo,
      txParticipantRepo,
    },
    usersById,
    roomsById,
  };
}

describe('RoomService lifecycle scenarios', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('createRoom: creates room + owner participant and invalidates payload cache', async () => {
    const { service, deps, usersById } = createFixture();
    usersById.set(1, buildUser(1, 'owner'));
    deps.catalog.getGame.mockResolvedValueOnce({
      id: 'lama',
      name: 'Lama',
      maxPlayers: 6,
      status: 'published',
    });
    const leaveAllSpy = jest
      .spyOn(service, 'leaveAllRoomsForUser')
      .mockResolvedValue(undefined);
    const invalidateSpy = jest
      .spyOn(service, 'invalidateRoomPayloadCache')
      .mockResolvedValue(undefined);

    const room = await service.createRoom(
      1,
      'lama',
      '  Ma table  ',
      null,
      false,
    );

    expect(leaveAllSpy).toHaveBeenCalledWith(1);
    expect(deps.txRoomRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Ma table',
        gameType: 'lama',
        maxPlayers: 6,
        status: 'setup',
      }),
    );
    expect(deps.txParticipantRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'owner',
      }),
    );
    expect(room.id).toBe(10);
    expect(invalidateSpy).toHaveBeenCalledWith(10);
  });

  it('createRoom: blocks construction game for non-admin owner', async () => {
    const { service, deps, usersById } = createFixture();
    usersById.set(1, buildUser(1, 'owner', []));
    deps.catalog.getGame.mockResolvedValueOnce({
      id: 'under-construction',
      name: 'UC',
      maxPlayers: 4,
      status: 'construction',
    });

    await expect(service.createRoom(1, 'under-construction')).rejects.toThrow(
      'Jeu en construction: réservé aux admins',
    );
  });

  it('createRoom: allows construction game for admin owner', async () => {
    const { service, deps, usersById } = createFixture();
    usersById.set(1, buildUser(1, 'owner', ['ROLE_ADMIN']));
    deps.catalog.getGame.mockResolvedValueOnce({
      id: 'under-construction',
      name: 'UC',
      maxPlayers: 4,
      status: 'construction',
    });
    jest.spyOn(service, 'leaveAllRoomsForUser').mockResolvedValue(undefined);
    jest
      .spyOn(service, 'invalidateRoomPayloadCache')
      .mockResolvedValue(undefined);

    const room = await service.createRoom(1, 'under-construction');

    expect(room.id).toBe(10);
    expect(room.gameType).toBe('under-construction');
  });

  it('joinRoom: rejects private room without allowPrivate', async () => {
    const { service, usersById, roomsById } = createFixture();
    usersById.set(2, buildUser(2, 'player'));
    roomsById.set(10, buildRoom({ isPrivate: true }));

    await expect(service.joinRoom(10, 2)).rejects.toThrow('Table privée');
  });

  it('joinRoom: allows rejoin in started room when user is already participant', async () => {
    const { service, deps, usersById, roomsById } = createFixture();
    usersById.set(2, buildUser(2, 'player'));
    roomsById.set(
      10,
      buildRoom({
        status: 'started',
        startedAt: new Date('2026-03-02T12:00:00.000Z'),
      }),
    );
    deps.participants.findOne.mockResolvedValueOnce({
      id: 100,
      user: { id: 2, username: 'player' },
    });
    const leaveAllSpy = jest
      .spyOn(service, 'leaveAllRoomsForUser')
      .mockResolvedValue(undefined);
    const invalidateSpy = jest
      .spyOn(service, 'invalidateRoomPayloadCache')
      .mockResolvedValue(undefined);

    const room = await service.joinRoom(10, 2);

    expect(room.id).toBe(10);
    expect(leaveAllSpy).toHaveBeenCalledWith(2, { exceptRoomId: 10 });
    expect(invalidateSpy).toHaveBeenCalledWith(10);
    expect(deps.presence.broadcastPresence).toHaveBeenCalled();
  });

  it('joinRoom: rejects started room for non-participant', async () => {
    const { service, deps, usersById, roomsById } = createFixture();
    usersById.set(2, buildUser(2, 'player'));
    roomsById.set(
      10,
      buildRoom({
        status: 'started',
        startedAt: new Date('2026-03-02T12:00:00.000Z'),
      }),
    );
    deps.participants.findOne.mockResolvedValueOnce(null);

    await expect(service.joinRoom(10, 2)).rejects.toThrow(
      'Table déjà démarrée',
    );
  });

  it('joinRoom: rejects full room', async () => {
    const { service, deps, usersById, roomsById } = createFixture();
    usersById.set(2, buildUser(2, 'player'));
    roomsById.set(10, buildRoom({ maxPlayers: 2 }));
    deps.participants.findOne.mockResolvedValueOnce(null);
    deps.participants.count.mockResolvedValueOnce(2);
    deps.botService.countBotsForRoom.mockResolvedValueOnce(0);

    await expect(service.joinRoom(10, 2)).rejects.toThrow('Table pleine');
  });

  it('joinRoom: creates participant for open room', async () => {
    const { service, deps, usersById, roomsById } = createFixture();
    usersById.set(2, buildUser(2, 'player'));
    roomsById.set(10, buildRoom({ maxPlayers: 4 }));
    deps.participants.findOne.mockResolvedValueOnce(null);
    deps.participants.count.mockResolvedValueOnce(1);
    deps.botService.countBotsForRoom.mockResolvedValueOnce(0);
    jest.spyOn(service, 'leaveAllRoomsForUser').mockResolvedValue(undefined);
    jest
      .spyOn(service, 'invalidateRoomPayloadCache')
      .mockResolvedValue(undefined);

    const room = await service.joinRoom(10, 2);

    expect(room.id).toBe(10);
    expect(deps.participants.create).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'player',
      }),
    );
    expect(deps.participants.save).toHaveBeenCalled();
    expect(deps.presence.broadcastPresence).toHaveBeenCalled();
  });

  it('joinRoom: does not duplicate participant when already present in open room', async () => {
    const { service, deps, usersById, roomsById } = createFixture();
    usersById.set(2, buildUser(2, 'player'));
    roomsById.set(10, buildRoom({ maxPlayers: 4 }));
    deps.participants.findOne.mockResolvedValueOnce({
      id: 101,
      room: { id: 10 },
      user: { id: 2, username: 'player' },
    });
    deps.participants.count.mockResolvedValueOnce(1);
    deps.botService.countBotsForRoom.mockResolvedValueOnce(0);
    jest.spyOn(service, 'leaveAllRoomsForUser').mockResolvedValue(undefined);
    jest
      .spyOn(service, 'invalidateRoomPayloadCache')
      .mockResolvedValue(undefined);

    await service.joinRoom(10, 2);

    expect(deps.participants.create).not.toHaveBeenCalled();
    expect(deps.participants.save).not.toHaveBeenCalled();
  });

  it('joinRoom: blocks construction game for non-admin player', async () => {
    const { service, deps, usersById, roomsById } = createFixture();
    usersById.set(2, buildUser(2, 'player', []));
    roomsById.set(10, buildRoom({ gameType: 'under-construction' }));
    deps.catalog.getGame.mockResolvedValueOnce({
      id: 'under-construction',
      status: 'construction',
      maxPlayers: 4,
    });

    await expect(service.joinRoom(10, 2)).rejects.toThrow(
      'Jeu en construction: réservé aux admins',
    );
  });

  it('startRoom: requires at least two total participants (humans+bots)', async () => {
    const { service, deps, usersById, roomsById } = createFixture();
    usersById.set(1, buildUser(1, 'owner'));
    roomsById.set(10, buildRoom({ owner: buildUser(1, 'owner') }));
    deps.participants.count.mockResolvedValueOnce(1);
    deps.botService.countBotsForRoom.mockResolvedValueOnce(0);

    await expect(service.startRoom(10, 1)).rejects.toThrow(
      'Au moins deux participants sont requis',
    );
  });

  it('startRoom: starts room, increments runId and records match stats', async () => {
    const { service, deps, usersById, roomsById } = createFixture();
    usersById.set(1, buildUser(1, 'owner'));
    const room = buildRoom({
      owner: buildUser(1, 'owner'),
      runId: 0,
      startedAt: null,
    });
    roomsById.set(10, room);
    deps.participants.count.mockResolvedValueOnce(1);
    deps.botService.countBotsForRoom.mockResolvedValueOnce(1);
    deps.participants.find.mockResolvedValueOnce([
      { user: { id: 1, username: 'owner' } },
      { user: { id: 2, username: 'player2' } },
    ]);
    jest
      .spyOn(service, 'invalidateRoomPayloadCache')
      .mockResolvedValue(undefined);

    const started = await service.startRoom(10, 1);

    expect(started.status).toBe('started');
    expect(started.runId).toBe(1);
    expect(started.startedAt).toBeInstanceOf(Date);
    expect(started.startedAt?.getMilliseconds()).toBe(0);
    expect(deps.stats.startMatch).toHaveBeenCalledWith({
      roomId: 10,
      gameType: 'lama',
      humans: [
        { id: 1, username: 'owner' },
        { id: 2, username: 'player2' },
      ],
      botsCount: 1,
    });
  });

  it('startRoom: keeps runId when startedAt already exists', async () => {
    const { service, deps, usersById, roomsById } = createFixture();
    usersById.set(1, buildUser(1, 'owner'));
    const room = buildRoom({
      owner: buildUser(1, 'owner'),
      runId: 5,
      startedAt: new Date('2026-03-01T09:00:00.000Z'),
      status: 'started',
    });
    roomsById.set(10, room);
    deps.participants.count.mockResolvedValueOnce(1);
    deps.botService.countBotsForRoom.mockResolvedValueOnce(1);
    deps.participants.find.mockResolvedValueOnce([]);
    jest
      .spyOn(service, 'invalidateRoomPayloadCache')
      .mockResolvedValue(undefined);

    const started = await service.startRoom(10, 1);

    expect(started.runId).toBe(5);
    expect(started.startedAt?.toISOString()).toBe('2026-03-01T09:00:00.000Z');
  });

  it('resetRoom: returns room to setup and sends endMatchOnReset for started games', async () => {
    const { service, deps, usersById, roomsById } = createFixture();
    usersById.set(1, buildUser(1, 'owner'));
    roomsById.set(
      10,
      buildRoom({
        owner: buildUser(1, 'owner'),
        status: 'started',
        startedAt: new Date('2026-03-02T12:00:00.000Z'),
      }),
    );
    deps.catalog.getGame.mockResolvedValueOnce({
      id: 'lama',
      maxPlayers: 4,
      status: 'published',
    });
    jest
      .spyOn(service, 'invalidateRoomPayloadCache')
      .mockResolvedValue(undefined);

    const room = await service.resetRoom(10, 1);

    expect(room.status).toBe('setup');
    expect(room.startedAt).toBeNull();
    expect(deps.stats.endMatchOnReset).toHaveBeenCalledWith(10);
  });

  it('togglePrivacy: toggles privacy and invalidates cache', async () => {
    const { service, usersById, roomsById } = createFixture();
    usersById.set(1, buildUser(1, 'owner'));
    const room = buildRoom({
      owner: buildUser(1, 'owner'),
      isPrivate: false,
    });
    roomsById.set(10, room);
    const invalidateSpy = jest
      .spyOn(service, 'invalidateRoomPayloadCache')
      .mockResolvedValue(undefined);

    const updated = await service.togglePrivacy(10, 1);

    expect(updated.isPrivate).toBe(true);
    expect(invalidateSpy).toHaveBeenCalledWith(10);
  });

  it('leaveRoom: disconnectOnly preserves participant state and returns room', async () => {
    const { service, deps, usersById, roomsById } = createFixture();
    usersById.set(1, buildUser(1, 'owner'));
    const room = buildRoom({ owner: buildUser(1, 'owner') });
    roomsById.set(10, room);
    deps.participants.findOne.mockResolvedValueOnce({
      id: 100,
      user: { id: 1, username: 'owner' },
      room: { id: 10 },
      leftAt: null,
    });

    const result = await service.leaveRoom(10, 1, { disconnectOnly: true });

    expect(result).toBe(room);
    expect(deps.participants.save).not.toHaveBeenCalled();
    expect(deps.presence.broadcastPresence).toHaveBeenCalled();
  });

  it('leaveRoom: transfers owner when current owner leaves and another participant is active', async () => {
    const { service, deps, usersById, roomsById } = createFixture();
    usersById.set(1, buildUser(1, 'owner'));
    const room = buildRoom({
      owner: buildUser(1, 'owner'),
      status: 'setup',
      startedAt: null,
    });
    roomsById.set(10, room);
    deps.participants.findOne
      .mockResolvedValueOnce({
        id: 100,
        user: { id: 1, username: 'owner' },
        room: { id: 10 },
        leftAt: null,
      })
      .mockResolvedValueOnce({
        id: 101,
        user: { id: 2, username: 'player2' },
      });
    deps.participants.count.mockResolvedValueOnce(1).mockResolvedValueOnce(1);
    deps.botService.countBotsForRoom.mockResolvedValueOnce(0);
    jest
      .spyOn(service, 'invalidateRoomPayloadCache')
      .mockResolvedValue(undefined);

    const result = await service.leaveRoom(10, 1);

    expect(result?.id).toBe(10);
    expect(room.owner?.id).toBe(2);
    expect(deps.rooms.save).toHaveBeenCalled();
  });

  it('leaveRoom: in started game, marks quit and adds replacement bot when humans remain', async () => {
    const { service, deps, usersById, roomsById } = createFixture();
    usersById.set(1, buildUser(1, 'player'));
    const room = buildRoom({
      owner: buildUser(2, 'owner2'),
      status: 'started',
      startedAt: new Date('2026-03-02T12:00:00.000Z'),
    });
    roomsById.set(10, room);
    deps.participants.findOne.mockResolvedValueOnce({
      id: 100,
      user: { id: 1, username: 'player' },
      room: { id: 10 },
      leftAt: null,
    });
    deps.participants.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);
    deps.botService.countBotsForRoom.mockResolvedValueOnce(0);
    jest
      .spyOn(service, 'invalidateRoomPayloadCache')
      .mockResolvedValue(undefined);

    await service.leaveRoom(10, 1);

    expect(deps.stats.markQuit).toHaveBeenCalledWith(10, 1);
    expect(deps.botService.addBotSystem).toHaveBeenCalledWith(10);
    expect(deps.rooms.delete).not.toHaveBeenCalled();
  });

  it('leaveRoom: deletes room when no humans and no bots remain', async () => {
    const { service, deps, usersById, roomsById } = createFixture();
    usersById.set(1, buildUser(1, 'player'));
    const room = buildRoom({
      owner: buildUser(2, 'owner2'),
      status: 'setup',
      startedAt: null,
    });
    roomsById.set(10, room);
    deps.participants.findOne.mockResolvedValueOnce({
      id: 100,
      user: { id: 1, username: 'player' },
      room: { id: 10 },
      leftAt: null,
    });
    deps.participants.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    deps.botService.countBotsForRoom.mockResolvedValueOnce(0);
    jest
      .spyOn(service, 'invalidateRoomPayloadCache')
      .mockResolvedValue(undefined);

    const result = await service.leaveRoom(10, 1);

    expect(result).toBeNull();
    expect(deps.botService.removeAllBotsForRoom).toHaveBeenCalledWith(10);
    expect(deps.rooms.delete).toHaveBeenCalledWith(10);
  });

  it('leaveAllRoomsForUser: skips exceptRoomId and leaves other active rooms', async () => {
    const { service, deps } = createFixture();
    deps.participants.find.mockResolvedValueOnce([
      { room: { id: 10 } },
      { room: { id: 11 } },
      { room: { id: 0 } },
    ]);
    const leaveSpy = jest.spyOn(service, 'leaveRoom').mockResolvedValue(null);

    await service.leaveAllRoomsForUser(1, { exceptRoomId: 10 });

    expect(leaveSpy).toHaveBeenCalledTimes(1);
    expect(leaveSpy).toHaveBeenCalledWith(11, 1, {
      preserveRoom: false,
      disconnectOnly: false,
    });
  });

  it('transferOwnerIfCurrent: reassigns owner when requester is current owner', async () => {
    const { service, deps, roomsById } = createFixture();
    const room = buildRoom({ owner: buildUser(1, 'owner') });
    roomsById.set(10, room);
    deps.participants.findOne.mockResolvedValueOnce({
      id: 120,
      user: { id: 3, username: 'next' },
    });
    const invalidateSpy = jest
      .spyOn(service, 'invalidateRoomPayloadCache')
      .mockResolvedValue(undefined);

    await service.transferOwnerIfCurrent(10, 1);

    expect(room.owner?.id).toBe(3);
    expect(deps.rooms.save).toHaveBeenCalledWith(room);
    expect(invalidateSpy).toHaveBeenCalledWith(10);
  });

  it('transferOwnerIfCurrent: no-op when requester is not current owner', async () => {
    const { service, deps, roomsById } = createFixture();
    roomsById.set(10, buildRoom({ owner: buildUser(2, 'owner2') }));

    await service.transferOwnerIfCurrent(10, 1);

    expect(deps.participants.findOne).not.toHaveBeenCalled();
    expect(deps.rooms.save).not.toHaveBeenCalled();
  });
});

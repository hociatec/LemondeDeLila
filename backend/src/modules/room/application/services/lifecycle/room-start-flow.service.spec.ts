import { RoomClientPolicyService } from '../membership/room-client-policy.service';
import { RoomLifecycleService } from './room-lifecycle.service';
import type { RoomPayload } from '../../contracts/room-payload.model';
import type { RoomRecord } from '../../contracts/room-record.model';
import { buildUniqueActiveRoomPlayers } from '../membership/room-participant-roster';

function payload(
  minPlayers: number,
  players: number[],
  bots: number[] = [],
): RoomPayload {
  return {
    manifest: {
      id: 'game',
      name: 'Jeu',
      minPlayers,
      maxPlayers: 4,
      chatEnabled: true,
      chatSoundsEnabled: true,
    },
    room: {
      id: 42,
      name: 'Table',
      gameType: 'game',
      isPrivate: false,
      maxPlayers: 4,
      status: 'setup',
      startedAt: null,
      counts: { players: players.length, spectators: 0 },
      owner: { id: 1, username: 'owner' },
      players: players.map((id) => ({ id, username: `user-${id}` })),
      spectators: [],
      bots: bots.map((id) => ({ id, name: `bot-${id}` })),
    },
    generatedAt: new Date(0).toISOString(),
  };
}

function room(): RoomRecord {
  return {
    id: 42,
    name: 'Table',
    gameType: 'game',
    maxPlayers: 4,
    isPrivate: false,
    status: 'setup',
    owner: { id: 1, username: 'owner', roles: [] },
    createdAt: new Date(0),
    startedAt: null,
    runId: 0,
    tableAmbienceSoundId: null,
    restoredFromSnapshotId: null,
    restoredOwnerUserId: null,
    participants: [],
    bots: [],
  };
}

describe('Room start flow', () => {
  it('deduplicates reconnect rows and excludes spectators from the canonical roster', () => {
    const players = buildUniqueActiveRoomPlayers([
      { role: 'owner', user: { id: 1, username: 'owner' }, leftAt: null },
      { role: 'player', user: { id: 1, username: 'owner' }, leftAt: null },
      { role: 'spectator', user: { id: 2, username: 'viewer' }, leftAt: null },
      { role: 'player', user: { id: 3, username: 'gone' }, leftAt: new Date() },
    ]);

    expect(players).toEqual([{ id: 1, username: 'owner' }]);
  });

  it('advertises room.start only when the server manifest minimum is met', () => {
    const policy = new RoomClientPolicyService();

    const alone = policy.listAllowedActions(payload(2, [1]), 1);
    expect(alone).not.toContain('room.start');
    expect(alone).toContain('bot.add');
    expect(alone).not.toContain('bot.remove');

    const ready = policy.listAllowedActions(payload(2, [1], [10]), 1);
    expect(ready).toContain('room.start');
    expect(ready).toContain('bot.remove');

    const needsThree = policy.listAllowedActions(payload(3, [1], [10]), 1);
    expect(needsThree).not.toContain('room.start');
    expect(policy.listAllowedActions(payload(3, [1, 2], [10]), 1)).toContain(
      'room.start',
    );

    const full = policy.listAllowedActions(payload(2, [1, 2, 3, 4]), 1);
    expect(full).not.toContain('bot.add');
  });

  it('removes setup-only actions after the room has started', () => {
    const policy = new RoomClientPolicyService();
    const started = payload(2, [1], [10]);
    started.room.status = 'started';
    started.room.startedAt = new Date(0).toISOString();

    const actions = policy.listAllowedActions(started, 1);
    expect(actions).not.toContain('room.start');
    expect(actions).not.toContain('bot.add');
    expect(actions).not.toContain('bot.remove');
  });

  it('enforces the same catalog minimum during the final start command', async () => {
    const rooms = {
      save: jest.fn(async (value: RoomRecord) => value),
    };
    const participants = {
      findActiveByRoomWithUsers: jest.fn(async () => []),
    };
    const catalog = {
      getGame: jest.fn(async () => ({ minPlayers: 3 })),
    };
    const stats = { startMatch: jest.fn(async () => undefined) };
    const events = { publishLobbyChanged: jest.fn(async () => undefined) };
    const lifecycle = new RoomLifecycleService(
      rooms as never,
      participants as never,
      {} as never,
      catalog as never,
      stats as never,
      events as never,
    );
    const current = room();
    const context = {
      invalidateRoomPayloadCache: jest.fn(async () => undefined),
      requireRoom: jest.fn(async () => current),
      countActiveHumans: jest.fn(async () => 1),
      countBots: jest.fn(async () => 1),
      ensureOwner: jest.fn(),
    };

    await expect(lifecycle.startRoom(context, 42, 1)).rejects.toThrow(
      'Au moins 3 participants sont requis',
    );
    expect(rooms.save).not.toHaveBeenCalled();

    context.countBots.mockResolvedValueOnce(2);
    await expect(lifecycle.startRoom(context, 42, 1)).resolves.toBe(current);
    expect(current.status).toBe('started');
    expect(rooms.save).toHaveBeenCalledTimes(1);
  });

  it('supports games whose backend manifest explicitly permits solo play', async () => {
    const current = room();
    const rooms = { save: jest.fn(async (value: RoomRecord) => value) };
    const lifecycle = new RoomLifecycleService(
      rooms as never,
      { findActiveByRoomWithUsers: jest.fn(async () => []) } as never,
      {} as never,
      { getGame: jest.fn(async () => ({ minPlayers: 1 })) } as never,
      { startMatch: jest.fn(async () => undefined) } as never,
      { publishLobbyChanged: jest.fn(async () => undefined) } as never,
    );
    const context = {
      invalidateRoomPayloadCache: jest.fn(async () => undefined),
      requireRoom: jest.fn(async () => current),
      countActiveHumans: jest.fn(async () => 1),
      countBots: jest.fn(async () => 0),
      ensureOwner: jest.fn(),
    };

    await expect(lifecycle.startRoom(context, 42, 1)).resolves.toBe(current);
    expect(current.status).toBe('started');
  });

  it('unlocks setup actions when a finished game prepares the next run', async () => {
    const current = room();
    current.status = 'started';
    current.startedAt = new Date(0);
    const rooms = {
      findById: jest.fn().mockResolvedValue(current),
      update: jest.fn(async (_id: number, values: Partial<RoomRecord>) => {
        Object.assign(current, values);
      }),
    };
    const events = { publishLobbyChanged: jest.fn() };
    const lifecycle = new RoomLifecycleService(
      rooms as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      events as never,
    );
    const context = {
      invalidateRoomPayloadCache: jest.fn(),
      requireRoom: jest.fn().mockResolvedValue(current),
    };

    await lifecycle.prepareNextRun(context as never, 42);

    expect(current).toMatchObject({ status: 'setup', startedAt: null });
    expect(context.invalidateRoomPayloadCache).toHaveBeenCalledWith(42);
    expect(events.publishLobbyChanged).toHaveBeenCalledWith(42, 'finished');
    const actions = new RoomClientPolicyService().listAllowedActions(
      payload(2, [1], [10]),
      1,
    );
    expect(actions).toEqual(
      expect.arrayContaining(['room.start', 'bot.add', 'bot.remove']),
    );
  });
});
/** Room application capability boundary. */

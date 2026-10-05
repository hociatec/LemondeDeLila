import { RoomLeaveService } from './room-leave.service';

describe('RoomLeaveService', () => {
  it('replaces a departing player and makes the table relaunchable', async () => {
    const departing = { id: 1, username: 'Lila', roles: [] };
    const remaining = { id: 2, username: 'Mina', roles: [] };
    const participant = {
      id: 10,
      user: departing,
      role: 'player',
      joinedAt: new Date(0),
      leftAt: null as Date | null,
    };
    const room = {
      id: 42,
      name: 'Table',
      gameType: 'morpion',
      maxPlayers: 2,
      isPrivate: false,
      status: 'started',
      owner: departing,
      createdAt: new Date(0),
      startedAt: new Date(1),
      runId: 1,
      tableAmbienceSoundId: null,
      restoredFromSnapshotId: null,
      restoredOwnerUserId: null,
      participants: [],
      bots: [],
    };
    const rooms = { save: jest.fn(async (value) => value) };
    const participants = {
      findActiveByRoomAndUser: jest.fn(async () => participant),
      save: jest.fn(async (value) => value),
      findFirstActiveByRoomWithUser: jest.fn(async () => ({ user: remaining })),
    };
    const botOperations = { addSystemBot: jest.fn(async () => undefined) };
    const events = {
      publishLobbyChanged: jest.fn(async () => undefined),
      publishRoomStateUpdated: jest.fn(async () => undefined),
    };
    const context = {
      requireRoom: jest.fn(async () => room),
      requireUser: jest.fn(async () => departing),
      invalidateRoomPayloadCache: jest.fn(async () => undefined),
      countActiveHumans: jest.fn(async () => 1),
    };
    const stats = {
      markQuit: jest.fn(async () => undefined),
      endMatchOnReset: jest.fn(async () => undefined),
    };
    const service = new RoomLeaveService(
      rooms as never,
      participants as never,
      botOperations as never,
      { broadcastPresence: jest.fn() } as never,
      stats as never,
      events as never,
      {
        abandonRestoredRoomIfEmpty: jest.fn(async () => false),
        deleteRoomIfEmpty: jest.fn(async () => false),
      } as never,
      { now: () => 5_000 } as never,
    );

    await service.leave(context as never, room.id, departing.id);

    expect(participant.leftAt).toEqual(new Date(5_000));
    expect(botOperations.addSystemBot).toHaveBeenCalledWith(room.id);
    expect(room).toMatchObject({
      owner: remaining,
      status: 'setup',
      startedAt: null,
    });
    expect(events.publishRoomStateUpdated).toHaveBeenCalledWith(room.id);
    expect(stats.endMatchOnReset).toHaveBeenCalledWith(room.id);
    expect(events.publishLobbyChanged).toHaveBeenCalledWith(room.id, 'left');
  });
});

import { RoomMembershipService } from './room-membership.service';
import type { RoomMembershipContext } from '../../models/room-membership-context.model';
import type { RoomRecord } from '../../models/room-record.model';

function fixture(active: boolean) {
  type Dependencies = ConstructorParameters<typeof RoomMembershipService>;
  const room = {
    id: 4,
    gameType: 'example',
    isPrivate: true,
    status: 'waiting',
    maxPlayers: 4,
  } as RoomRecord;
  const participants = {
    findActiveByRoomAndUser: jest
      .fn()
      .mockResolvedValue(
        active ? { id: 12, role: 'player', leftAt: null } : null,
      ),
    save: jest.fn(),
  };
  const context = {
    requireRoom: jest.fn().mockResolvedValue(room),
    requireUser: jest.fn().mockResolvedValue({ id: 2, roles: [] }),
    leaveAllRoomsForUser: jest.fn().mockResolvedValue(undefined),
    invalidateRoomPayloadCache: jest.fn().mockResolvedValue(undefined),
  };
  const publishLobbyChanged = jest.fn().mockResolvedValue(undefined);
  const service = new RoomMembershipService(
    {} as Dependencies[0],
    participants as unknown as Dependencies[1],
    { broadcastPresence: jest.fn() } as unknown as Dependencies[2],
    {
      getGame: jest.fn().mockResolvedValue({ status: 'available' }),
    } as unknown as Dependencies[3],
    {} as Dependencies[4],
    { publishLobbyChanged } as unknown as Dependencies[5],
    {} as Dependencies[6],
    {} as Dependencies[7],
  );
  return { service, room, participants, context, publishLobbyChanged };
}

it.each(['waiting', 'started'])(
  'connects an invited participant to a private %s table',
  async (status) => {
    const { service, room, context, participants, publishLobbyChanged } =
      fixture(true);
    room.status = status;
    await expect(
      service.joinRoom(context as unknown as RoomMembershipContext, 4, 2),
    ).resolves.toBe(room);
    expect(participants.save).not.toHaveBeenCalled();
    expect(context.leaveAllRoomsForUser).toHaveBeenCalledWith(2, {
      exceptRoomId: 4,
    });
    expect(publishLobbyChanged).toHaveBeenCalledWith(4, 'joined');
  },
);

it('refuses a private table without an active participant or invitation authorization', async () => {
  const { service, context, participants } = fixture(false);
  await expect(
    service.joinRoom(context as unknown as RoomMembershipContext, 4, 2),
  ).rejects.toThrow('Table privée');
  expect(participants.save).not.toHaveBeenCalled();
  expect(context.leaveAllRoomsForUser).not.toHaveBeenCalled();
});

it('does not use a spectator record to grant private player access', async () => {
  const { service, context, participants } = fixture(true);
  participants.findActiveByRoomAndUser.mockResolvedValue({
    id: 12,
    role: 'spectator',
    leftAt: null,
  });
  await expect(
    service.joinRoom(context as unknown as RoomMembershipContext, 4, 2),
  ).rejects.toThrow('Table privée');
  expect(context.leaveAllRoomsForUser).not.toHaveBeenCalled();
});

import { RoomGameAccessService } from './room-game-access.service';
import type { RoomRecord } from '../../models/room-record.model';

function fixture() {
  const room: RoomRecord = {
    id: 4,
    name: 'Room',
    gameType: 'example',
    maxPlayers: 4,
    isPrivate: true,
    status: 'started',
    owner: { id: 1, username: 'owner', roles: [] },
    createdAt: new Date(0),
    startedAt: new Date(0),
    runId: 1,
    tableAmbienceSoundId: null,
    restoredFromSnapshotId: null,
    restoredOwnerUserId: null,
    bots: [],
    participants: [
      {
        id: 2,
        room: { id: 4, gameType: 'example' },
        user: { id: 2, username: 'player', roles: [] },
        role: 'player',
        joinedAt: new Date(0),
        leftAt: null,
      },
    ],
  };
  const read = jest
    .fn<Promise<RoomRecord | null>, [number]>()
    .mockResolvedValue(room);
  return {
    room,
    read,
    service: new RoomGameAccessService({ findByIdWithPayloadRelations: read }),
  };
}

it('permits only owner or current players to write, including when the room is public', async () => {
  const { service, room } = fixture();
  await expect(service.authorize(4, 1, 'write')).resolves.toBeUndefined();
  await expect(service.authorize(4, 2, 'write')).resolves.toBeUndefined();
  await expect(service.authorize(4, 3, 'read')).rejects.toThrow();
  room.isPrivate = false;
  await expect(service.authorize(4, 3, 'read')).resolves.toBeUndefined();
  await expect(service.authorize(4, 3, 'write')).rejects.toThrow();
});

it('reads fresh membership on every request and rejects departed players and spectators', async () => {
  const { service, room, read } = fixture();
  await service.authorize(4, 2, 'write');
  room.participants[0].leftAt = new Date(1);
  await expect(service.authorize(4, 2, 'write')).rejects.toThrow();
  room.participants[0].leftAt = null;
  room.participants[0].role = 'spectator';
  await expect(service.authorize(4, 2, 'write')).rejects.toThrow();
  expect(read).toHaveBeenCalledTimes(3);
});

it('fails closed when the room is missing or persistence is unavailable', async () => {
  const { service, read } = fixture();
  read.mockResolvedValueOnce(null);
  await expect(service.authorize(4, 1, 'read')).rejects.toThrow();
  read.mockRejectedValueOnce(new Error('database unavailable'));
  await expect(service.authorize(4, 1, 'write')).rejects.toThrow(
    'database unavailable',
  );
  await expect(service.authorize(4, 0, 'write')).rejects.toThrow();
  expect(read).toHaveBeenCalledTimes(2);
});

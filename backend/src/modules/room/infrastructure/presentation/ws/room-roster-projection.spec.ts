import type { RoomPayload } from '../../../application/models/room-payload.model';
import { projectRoomRoster } from './room-roster-projection';
import type { ClientMetaLike } from './room-roster';

function fixture(): RoomPayload {
  return {
    manifest: null,
    generatedAt: '2026-09-09T00:00:00.000Z',
    room: {
      id: 1,
      name: 'Room',
      isPrivate: false,
      maxPlayers: 4,
      status: 'waiting',
      gameType: 'test',
      owner: null,
      counts: { players: 1, spectators: 0 },
      players: [{ id: 1, username: 'Alice' }],
      spectators: [],
      bots: [],
    },
  };
}

const spectator: ClientMetaLike = {
  roomId: 1,
  userId: 1,
  username: 'Alice',
  role: 'spectator',
  silent: false,
};

it('projects waiting-room spectators without changing the source payload', () => {
  const source = fixture();
  const before = structuredClone(source);
  const projected = projectRoomRoster(source, [spectator], 1);
  expect(projected.room.players).toEqual([]);
  expect(projected.room.spectators).toEqual([{ id: 1, username: 'Alice' }]);
  expect(projected.room.counts).toEqual({ players: 0, spectators: 1 });
  expect(source).toEqual(before);
  projected.room.spectators[0].username = 'Changed';
  expect(spectator.username).toBe('Alice');
});

it('keeps started players out of the spectator list', () => {
  const source = fixture();
  source.room.status = 'started';
  const projected = projectRoomRoster(source, [spectator], 1);
  expect(projected.room.players).toHaveLength(1);
  expect(projected.room.spectators).toEqual([]);
});

it('keeps hidden-self presentation local to one recipient', () => {
  const source = fixture();
  const hidden = { ...spectator, userId: 2, username: 'Bob', silent: true };
  const privateView = projectRoomRoster(source, [hidden], 1, {
    includeHiddenSelf: hidden,
  });
  const publicView = projectRoomRoster(source, [hidden], 1);
  expect(privateView.room.spectators).toEqual([{ id: 2, username: 'Bob' }]);
  expect(publicView.room.spectators).toEqual([]);
  expect(source.room.spectators).toEqual([]);
});

it('can derive both lists from a single-use iterator', () => {
  const clients = new Map([
    [1, { ...spectator, userId: 2, role: 'participant' as const }],
  ]);
  const projected = projectRoomRoster(fixture(), clients.values(), 1, {
    includeRealtimePlayers: true,
  });
  expect(projected.room.players.map((player) => player.id)).toEqual([1, 2]);
  expect(projected.room.counts.players).toBe(2);
});

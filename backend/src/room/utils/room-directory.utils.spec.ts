import { buildPublicRoomList } from './room-directory.utils';
import { Room } from '../entities/room.entity';
import { RoomBot } from '../entities/room-bot.entity';
import { RoomParticipant } from '../entities/room-participant.entity';
import { User } from '../../user/entities/user.entity';

function makeUser(id: number, username: string): User {
  return {
    id,
    username,
    email: `${username}@example.test`,
    roles: [],
    password: 'x',
    emailVerified: true,
    createdAt: new Date(),
  };
}

function makeParticipant(
  userId: number,
  leftAt?: Date | null,
): RoomParticipant {
  return {
    id: userId,
    room: {} as Room,
    user: makeUser(userId, `u${userId}`),
    role: 'player',
    joinedAt: new Date(),
    leftAt: leftAt ?? null,
  };
}

function makeBot(id: number): RoomBot {
  return {
    id,
    room: {} as Room,
    name: `bot${id}`,
    createdAt: new Date(),
  };
}

function makeRoom(
  partial: Partial<Room> & Pick<Room, 'id' | 'gameType'>,
): Room {
  return {
    id: partial.id,
    name: partial.name ?? `Room ${partial.id}`,
    gameType: partial.gameType,
    maxPlayers: partial.maxPlayers ?? 4,
    isPrivate: partial.isPrivate ?? false,
    status: partial.status ?? 'open',
    owner: partial.owner ?? null,
    createdAt: partial.createdAt ?? new Date(),
    startedAt: partial.startedAt ?? null,
    participants: partial.participants ?? [],
    bots: partial.bots ?? [],
  };
}

describe('buildPublicRoomList', () => {
  it('filters out rooms that have startedAt set, even if status looks open', () => {
    const started = makeRoom({
      id: 1,
      gameType: 'dame-nature',
      status: 'open',
      startedAt: new Date(),
      participants: [makeParticipant(1)],
    });
    const joinable = makeRoom({
      id: 2,
      gameType: 'dame-nature',
      status: 'open',
      participants: [makeParticipant(2)],
    });

    const { items } = buildPublicRoomList([started, joinable]);
    expect(items.map((i) => i.id)).toEqual([2]);
  });

  it('filters out rooms that are already full (players + bots >= maxPlayers)', () => {
    const full = makeRoom({
      id: 1,
      gameType: 'panier-express',
      status: 'open',
      maxPlayers: 2,
      participants: [makeParticipant(1), makeParticipant(2)],
    });
    const joinable = makeRoom({
      id: 2,
      gameType: 'panier-express',
      status: 'open',
      maxPlayers: 2,
      participants: [makeParticipant(3)],
      bots: [],
    });

    const { items } = buildPublicRoomList([full, joinable]);
    expect(items.map((i) => i.id)).toEqual([2]);
  });

  it('does not count participants that already left', () => {
    const room = makeRoom({
      id: 1,
      gameType: 'dame-nature',
      status: 'open',
      maxPlayers: 2,
      participants: [makeParticipant(1, new Date()), makeParticipant(2, null)],
      bots: [makeBot(1)],
    });
    const { items } = buildPublicRoomList([room]);
    expect(items).toHaveLength(0);
  });

  it('groups rooms by gameType and sorts groups case-insensitively', () => {
    const a = makeRoom({ id: 1, gameType: 'Alpha', status: 'open' });
    const b = makeRoom({ id: 2, gameType: 'beta', status: 'open' });
    const a2 = makeRoom({ id: 3, gameType: 'Alpha', status: 'open' });

    const { groups } = buildPublicRoomList([b, a, a2]);
    expect(groups.map((g) => g.gameType)).toEqual(['Alpha', 'beta']);
    expect(groups[0]?.rooms.map((r) => r.id)).toEqual([1, 3]);
  });

  it('filters out private rooms', () => {
    const priv = makeRoom({ id: 1, gameType: 'dame-nature', isPrivate: true });
    const pub = makeRoom({ id: 2, gameType: 'dame-nature', isPrivate: false });
    const { items } = buildPublicRoomList([priv, pub]);
    expect(items.map((i) => i.id)).toEqual([2]);
  });

  it('can filter out unknown game types when provided an allow-list', () => {
    const known = makeRoom({ id: 1, gameType: 'dame-nature', status: 'open' });
    const unknown = makeRoom({ id: 2, gameType: 'generic', status: 'open' });
    const { items } = buildPublicRoomList([known, unknown], {
      allowedGameTypes: new Set(['dame-nature']),
    });
    expect(items.map((i) => i.id)).toEqual([1]);
  });
});

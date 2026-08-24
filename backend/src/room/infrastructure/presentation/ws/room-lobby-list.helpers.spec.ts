import { buildPublicRoomList } from './room-lobby-list.helpers';
import { Room } from '../../persistence/typeorm/entities/room.entity';
import { RoomBot } from '../../persistence/typeorm/entities/room-bot.entity';
import { RoomParticipant } from '../../persistence/typeorm/entities/room-participant.entity';
import { User } from '../../../../user/public-api';

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
    runId: partial.runId ?? 0,
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
  it('includes rooms that have startedAt set as spectator-only', () => {
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
    expect(items.map((i) => i.id).sort()).toEqual([1, 2]);
    const startedItem = items.find((i) => i.id === 1);
    expect(startedItem?.spectatorOnly).toBe(true);
    expect(startedItem?.started).toBe(true);
    const joinableItem = items.find((i) => i.id === 2);
    expect(joinableItem?.spectatorOnly).toBe(false);
    expect(joinableItem?.started).toBe(false);
  });

  it('keeps open rooms listed even when they are full (spectator access)', () => {
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
    expect(items.map((i) => i.id)).toEqual([1, 2]);
  });
});

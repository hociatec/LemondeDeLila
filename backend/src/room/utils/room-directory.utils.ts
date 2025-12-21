import { OPEN_ROOM_STATUSES } from '../constants/room-status.constants';
import { Room } from '../entities/room.entity';

export type PublicRoomListItem = {
  id: number;
  name: string;
  gameType: string;
  status: string;
  maxPlayers: number;
  playersCount: number;
  botsCount: number;
  owner: { id: number; username: string } | null;
};

function isRoomOpenStatus(status: unknown): boolean {
  const normalized = typeof status === 'string' ? status.toLowerCase() : '';
  return OPEN_ROOM_STATUSES.includes(
    normalized as (typeof OPEN_ROOM_STATUSES)[number],
  );
}

function countActiveParticipants(room: Room): number {
  return (room.participants || []).filter((p) => !p.leftAt).length;
}

export function buildPublicRoomList(
  rooms: Room[],
  opts?: { allowedGameTypes?: ReadonlySet<string> },
): {
  items: PublicRoomListItem[];
  groups: { gameType: string; rooms: PublicRoomListItem[] }[];
} {
  const allowedGameTypes = opts?.allowedGameTypes;
  const items = rooms
    .filter((room) => {
      if (!room.gameType || !room.gameType.trim()) {
        return false;
      }
      if (allowedGameTypes && !allowedGameTypes.has(room.gameType)) {
        return false;
      }
      if (room.isPrivate) {
        return false;
      }
      if (room.startedAt) {
        return false;
      }
      if (!isRoomOpenStatus(room.status)) {
        return false;
      }
      const playersCount = countActiveParticipants(room);
      const botsCount = (room.bots || []).length;
      return playersCount + botsCount < room.maxPlayers;
    })
    .map((room) => {
      const playersCount = countActiveParticipants(room);
      const botsCount = (room.bots || []).length;
      return {
        id: room.id,
        name: room.name,
        gameType: room.gameType,
        status: room.status,
        maxPlayers: room.maxPlayers,
        playersCount,
        botsCount,
        owner: room.owner
          ? { id: room.owner.id, username: room.owner.username }
          : null,
      };
    });

  const grouped = new Map<string, PublicRoomListItem[]>();
  for (const item of items) {
    const key = item.gameType || '';
    const existing = grouped.get(key);
    if (existing) {
      existing.push(item);
    } else {
      grouped.set(key, [item]);
    }
  }

  const groups = Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    .map(([gameType, groupRooms]) => ({ gameType, rooms: groupRooms }));

  return { items, groups };
}

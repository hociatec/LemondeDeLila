import { OPEN_ROOM_STATUSES } from '../../../application/models/room-status.model';

type RoomLobbyUser = {
  id: number;
  username: string;
};

type RoomLobbyParticipant = {
  user?: RoomLobbyUser | null;
  leftAt?: Date | null;
};

type RoomLobbyBot = {
  id: number;
};

type RoomLobbyRecord = {
  id: number;
  name: string;
  gameType: string;
  status: string;
  startedAt?: Date | null;
  isPrivate: boolean;
  maxPlayers: number;
  owner?: RoomLobbyUser | null;
  participants?: RoomLobbyParticipant[];
  bots?: RoomLobbyBot[];
};

export type PublicRoomListItem = {
  id: number;
  name: string;
  gameType: string;
  status: string;
  started: boolean;
  spectatorOnly: boolean;
  banned?: boolean;
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

function countActiveParticipants(room: RoomLobbyRecord): number {
  const active = (room.participants || []).filter((p) => !p.leftAt);
  const activeCount = active.length;
  const ownerId = room.owner?.id;
  if (!ownerId) return activeCount;

  const ownerAlreadyCounted = active.some((p) => p.user?.id === ownerId);
  return ownerAlreadyCounted ? activeCount : activeCount + 1;
}

export function buildPublicRoomList(
  rooms: RoomLobbyRecord[],
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
        return true;
      }

      return isRoomOpenStatus(room.status);
    })
    .map((room) => {
      const playersCount = countActiveParticipants(room);
      const botsCount = (room.bots || []).length;
      const started = !!room.startedAt;
      return {
        id: room.id,
        name: room.name,
        gameType: room.gameType,
        status: room.status,
        started,
        spectatorOnly: started,
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

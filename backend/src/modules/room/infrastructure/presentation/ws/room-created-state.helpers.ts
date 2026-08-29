import type {
  RoomPayload,
  RoomPlayer,
} from '../../../application/models/room-payload.model';

type RoomCreatedManifest =
  | {
      id: string;
      name: string;
      minPlayers?: number | null;
      maxPlayers?: number | null;
      chatEnabled?: boolean | null;
      chatSoundsEnabled?: boolean | null;
    }
  | null
  | undefined;

type RoomCreatedRoom = {
  id: number;
  name: string;
  isPrivate: boolean;
  maxPlayers: number;
  status: string;
  gameType: string;
  startedAt?: Date | null;
};

export function buildCreatedRoomState(params: {
  manifest: RoomCreatedManifest;
  room: RoomCreatedRoom;
  userId: number;
  username: string;
}): RoomPayload {
  const { manifest, room, userId, username } = params;
  const player = {
    id: userId,
    username,
  } satisfies RoomPlayer;

  return {
    manifest: manifest
      ? {
          id: manifest.id,
          name: manifest.name,
          minPlayers: manifest.minPlayers ?? 2,
          maxPlayers: manifest.maxPlayers ?? room.maxPlayers,
          chatEnabled: manifest.chatEnabled !== false,
          chatSoundsEnabled: manifest.chatSoundsEnabled !== false,
        }
      : null,
    room: {
      id: room.id,
      name: room.name,
      isPrivate: room.isPrivate,
      maxPlayers: room.maxPlayers,
      status: room.status,
      gameType: room.gameType,
      startedAt: room.startedAt ? room.startedAt.toISOString() : null,
      counts: { players: 1, spectators: 0 },
      owner: { id: userId, username },
      players: [player],
      spectators: [],
      bots: [],
    },
    generatedAt: new Date().toISOString(),
  };
}

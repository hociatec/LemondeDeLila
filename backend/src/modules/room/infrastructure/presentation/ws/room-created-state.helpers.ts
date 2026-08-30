import type {
  RoomPayload,
  RoomPlayer,
} from '../../../application/contracts/room-payload.model';

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
  runId?: number | null;
  tableAmbienceSoundId?: string | null;
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
      // The setup game state is deliberately attached to the next run.  Keep
      // this field in the eagerly primed payload too; otherwise game.join sees
      // a different room contract until the cache is rebuilt from storage.
      runId:
        typeof room.runId === 'number' && Number.isFinite(room.runId)
          ? room.runId
          : 0,
      tableAmbienceSoundId: room.tableAmbienceSoundId ?? null,
      counts: { players: 1, spectators: 0 },
      owner: { id: userId, username },
      players: [player],
      spectators: [],
      bots: [],
    },
    generatedAt: new Date().toISOString(),
  };
}

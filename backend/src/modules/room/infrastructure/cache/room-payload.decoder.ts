import type {
  GameManifest,
  RoomBotState,
  RoomPayload,
  RoomPlayer,
} from '../../application/models/room-payload.model';

export function decodeRoomPayload(value: unknown): RoomPayload | null {
  if (
    !isRecord(value) ||
    typeof value.generatedAt !== 'string' ||
    !isRecord(value.room)
  ) {
    return null;
  }
  const room = value.room;
  const manifest = decodeManifest(value.manifest);
  const owner = decodeNullablePlayer(room.owner);
  const players = decodeArray(room.players, decodePlayer);
  const spectators = decodeArray(room.spectators, decodePlayer);
  const bots = decodeArray(room.bots, decodeBot);
  if (
    (value.manifest !== null && !manifest) ||
    (room.owner !== null && !owner) ||
    !players ||
    !spectators ||
    !bots ||
    typeof room.id !== 'number' ||
    !Number.isSafeInteger(room.id) ||
    typeof room.name !== 'string' ||
    typeof room.isPrivate !== 'boolean' ||
    typeof room.maxPlayers !== 'number' ||
    !Number.isSafeInteger(room.maxPlayers) ||
    typeof room.status !== 'string' ||
    typeof room.gameType !== 'string' ||
    !isRecord(room.counts) ||
    typeof room.counts.players !== 'number' ||
    typeof room.counts.spectators !== 'number' ||
    !isOptionalNullableString(room.startedAt) ||
    !isOptionalNullableNumber(room.runId) ||
    !isOptionalNullableString(room.tableAmbienceSoundId) ||
    !isOptionalStringArray(room.allowedActions)
  ) {
    return null;
  }
  return {
    manifest,
    generatedAt: value.generatedAt,
    room: {
      id: room.id,
      name: room.name,
      isPrivate: room.isPrivate,
      maxPlayers: room.maxPlayers,
      status: room.status,
      gameType: room.gameType,
      startedAt: room.startedAt,
      runId: room.runId,
      tableAmbienceSoundId: room.tableAmbienceSoundId,
      counts: {
        players: room.counts.players,
        spectators: room.counts.spectators,
      },
      owner,
      players,
      spectators,
      bots,
      allowedActions: room.allowedActions,
    },
  };
}

function decodeManifest(value: unknown): GameManifest | null {
  if (value === null) return null;
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.name !== 'string' ||
    typeof value.minPlayers !== 'number' ||
    typeof value.maxPlayers !== 'number' ||
    typeof value.chatEnabled !== 'boolean' ||
    typeof value.chatSoundsEnabled !== 'boolean'
  ) {
    return null;
  }
  return {
    id: value.id,
    name: value.name,
    minPlayers: value.minPlayers,
    maxPlayers: value.maxPlayers,
    chatEnabled: value.chatEnabled,
    chatSoundsEnabled: value.chatSoundsEnabled,
  };
}

function decodeNullablePlayer(value: unknown): RoomPlayer | null {
  return value === null ? null : decodePlayer(value);
}

function decodePlayer(value: unknown): RoomPlayer | null {
  return isRecord(value) &&
    typeof value.id === 'number' &&
    Number.isSafeInteger(value.id) &&
    typeof value.username === 'string'
    ? { id: value.id, username: value.username }
    : null;
}

function decodeBot(value: unknown): RoomBotState | null {
  return isRecord(value) &&
    typeof value.id === 'number' &&
    Number.isSafeInteger(value.id) &&
    typeof value.name === 'string'
    ? { id: value.id, name: value.name }
    : null;
}

function decodeArray<T>(
  value: unknown,
  decode: (item: unknown) => T | null,
): T[] | null {
  if (!Array.isArray(value)) return null;
  const decoded = value.map(decode);
  return decoded.every((item): item is T => item !== null) ? decoded : null;
}

function isOptionalNullableString(
  value: unknown,
): value is string | null | undefined {
  return value === undefined || value === null || typeof value === 'string';
}

function isOptionalNullableNumber(
  value: unknown,
): value is number | null | undefined {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'number' && Number.isFinite(value))
  );
}

function isOptionalStringArray(value: unknown): value is string[] | undefined {
  return (
    value === undefined ||
    (Array.isArray(value) && value.every((item) => typeof item === 'string'))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

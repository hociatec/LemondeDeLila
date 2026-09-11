import type {
  GameManifest,
  RoomBotState,
  RoomPayload,
  RoomPlayer,
} from '../../application/models/room-payload.model';
import {
  asGameId,
  asRoomId,
  asUserId,
} from '../../../../shared/interfaces/public-api';

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
    room.id <= 0 ||
    typeof room.name !== 'string' ||
    room.name.length > 255 ||
    typeof room.isPrivate !== 'boolean' ||
    typeof room.maxPlayers !== 'number' ||
    !Number.isSafeInteger(room.maxPlayers) ||
    room.maxPlayers < 1 ||
    room.maxPlayers > 64 ||
    typeof room.status !== 'string' ||
    room.status.length > 64 ||
    typeof room.gameType !== 'string' ||
    !isGameId(room.gameType) ||
    !isRecord(room.counts) ||
    !isNonNegativeSafeInteger(room.counts.players) ||
    !isNonNegativeSafeInteger(room.counts.spectators) ||
    !isOptionalNullableString(room.startedAt) ||
    !isOptionalNullableRunId(room.runId) ||
    !isOptionalNullableString(room.tableAmbienceSoundId) ||
    !isOptionalStringArray(room.allowedActions) ||
    players.length > room.maxPlayers ||
    spectators.length > 1000 ||
    bots.length > 64
  ) {
    return null;
  }
  return {
    manifest,
    generatedAt: value.generatedAt,
    room: {
      id: asRoomId(room.id),
      name: room.name,
      isPrivate: room.isPrivate,
      maxPlayers: room.maxPlayers,
      status: room.status,
      gameType: asGameId(room.gameType),
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
    !isGameId(value.id) ||
    typeof value.name !== 'string' ||
    value.name.length > 128 ||
    typeof value.minPlayers !== 'number' ||
    typeof value.maxPlayers !== 'number' ||
    !Number.isSafeInteger(value.minPlayers) ||
    !Number.isSafeInteger(value.maxPlayers) ||
    value.minPlayers < 1 ||
    value.maxPlayers < value.minPlayers ||
    value.maxPlayers > 64 ||
    typeof value.chatEnabled !== 'boolean' ||
    typeof value.chatSoundsEnabled !== 'boolean'
  ) {
    return null;
  }
  return {
    id: asGameId(value.id),
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
    value.id > 0 &&
    typeof value.username === 'string' &&
    value.username.length <= 255
    ? { id: asUserId(value.id), username: value.username }
    : null;
}

function decodeBot(value: unknown): RoomBotState | null {
  return isRecord(value) &&
    typeof value.id === 'number' &&
    Number.isSafeInteger(value.id) &&
    typeof value.name === 'string' &&
    value.name.length <= 255
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

function isOptionalNullableRunId(
  value: unknown,
): value is number | null | undefined {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0)
  );
}

function isOptionalStringArray(value: unknown): value is string[] | undefined {
  return (
    value === undefined ||
    (Array.isArray(value) &&
      value.length <= 128 &&
      value.every((item) => typeof item === 'string' && item.length <= 128))
  );
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isGameId(value: string): boolean {
  return /^[a-z][a-z0-9-]{0,95}$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

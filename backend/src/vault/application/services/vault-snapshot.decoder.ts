import type { VaultRoomSnapshot } from '../../vault.types';
import { isVaultGameState } from '../models/vault-game-state.model';

export function decodeVaultRoomSnapshot(
  value: unknown,
): VaultRoomSnapshot | null {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    typeof value.savedAt !== 'string' ||
    !isRecord(value.room) ||
    !isRecord(value.roster) ||
    !isRecord(value.game)
  ) {
    return null;
  }
  const room = value.room;
  const roster = value.roster;
  const game = value.game;
  const players = decodeArray(roster.players, decodeRosterUser);
  const spectators =
    roster.spectators === undefined
      ? undefined
      : decodeArray(roster.spectators, decodeRosterUser);
  const bots = decodeArray(roster.bots, decodeRosterBot);
  if (
    typeof room.name !== 'string' ||
    typeof room.isPrivate !== 'boolean' ||
    typeof room.maxPlayers !== 'number' ||
    !Number.isSafeInteger(room.maxPlayers) ||
    !isNullableString(room.tableAmbienceSoundId) ||
    !isNullableSafeInteger(roster.ownerUserId) ||
    !players ||
    spectators === null ||
    !bots ||
    typeof game.gameType !== 'string' ||
    !isVaultGameState(game.state)
  ) {
    return null;
  }
  return {
    version: 1,
    savedAt: value.savedAt,
    room: {
      name: room.name,
      isPrivate: room.isPrivate,
      maxPlayers: room.maxPlayers,
      tableAmbienceSoundId: room.tableAmbienceSoundId,
    },
    roster: {
      ownerUserId: roster.ownerUserId,
      players,
      spectators,
      bots,
    },
    game: { gameType: game.gameType, state: game.state },
  };
}

function decodeRosterUser(
  value: unknown,
): { id: number; username: string } | null {
  return isRecord(value) &&
    typeof value.id === 'number' &&
    Number.isSafeInteger(value.id) &&
    typeof value.username === 'string'
    ? { id: value.id, username: value.username }
    : null;
}

function decodeRosterBot(value: unknown): { id: number; name: string } | null {
  return isRecord(value) &&
    typeof value.id === 'number' &&
    Number.isSafeInteger(value.id) &&
    typeof value.name === 'string'
    ? { id: value.id, name: value.name }
    : null;
}

function decodeArray<T>(
  value: unknown,
  decoder: (item: unknown) => T | null,
): T[] | null {
  if (!Array.isArray(value)) return null;
  const decoded = value.map(decoder);
  return decoded.every((item): item is T => item !== null) ? decoded : null;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isNullableSafeInteger(value: unknown): value is number | null {
  return (
    value === null || (typeof value === 'number' && Number.isSafeInteger(value))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

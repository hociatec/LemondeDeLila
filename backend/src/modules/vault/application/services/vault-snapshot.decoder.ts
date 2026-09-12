import type { VaultRoomSnapshot } from '../../vault.types';
import { isVaultGameState } from '../models/vault-game-state.model';
import { parseExplicitInstant } from '../../../../shared/utils/public-api';

export function decodeVaultRoomSnapshot(
  value: unknown,
): VaultRoomSnapshot | null {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    typeof value.savedAt !== 'string' ||
    parseExplicitInstant(value.savedAt) === null ||
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
    room.name.length > 255 ||
    typeof room.isPrivate !== 'boolean' ||
    typeof room.maxPlayers !== 'number' ||
    !Number.isSafeInteger(room.maxPlayers) ||
    room.maxPlayers < 1 ||
    room.maxPlayers > 64 ||
    !isNullableString(room.tableAmbienceSoundId) ||
    (typeof room.tableAmbienceSoundId === 'string' &&
      room.tableAmbienceSoundId.length > 128) ||
    !isNullableSafeInteger(roster.ownerUserId) ||
    !players ||
    players.length > room.maxPlayers ||
    !uniqueIds(players) ||
    spectators === null ||
    (spectators !== undefined && spectators.length > 1000) ||
    !bots ||
    bots.length > 64 ||
    !uniqueIds(bots) ||
    typeof game.gameType !== 'string' ||
    game.gameType.length > 128 ||
    !game.gameType.trim() ||
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
    value.id > 0 &&
    typeof value.username === 'string' &&
    value.username.length <= 255
    ? { id: value.id, username: value.username }
    : null;
}

function decodeRosterBot(value: unknown): { id: number; name: string } | null {
  return isRecord(value) &&
    typeof value.id === 'number' &&
    Number.isSafeInteger(value.id) &&
    value.id > 0 &&
    typeof value.name === 'string' &&
    value.name.length <= 255
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

function uniqueIds(values: { id: number }[]): boolean {
  return new Set(values.map((value) => value.id)).size === values.length;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isNullableSafeInteger(value: unknown): value is number | null {
  return (
    value === null ||
    (typeof value === 'number' && Number.isSafeInteger(value) && value > 0)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

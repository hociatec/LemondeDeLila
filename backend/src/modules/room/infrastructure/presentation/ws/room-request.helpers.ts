import { BadRequestException } from '@nestjs/common';
import { parseStrictInteger } from '@shared/utils/public-api';
import { resolveTruthyFlag } from './room-role.helpers';

export type RoomCreateRequest = {
  gameType: string;
  name: string | null;
  maxPlayers: number | null;
  isPrivate: boolean;
};

export type RoomJoinRequest = {
  roomId: number;
  spectator: boolean;
  silent: boolean;
};

export function parseRoomCreateRequest(
  row: Record<string, unknown>,
): RoomCreateRequest {
  const payload =
    row.payload &&
    typeof row.payload === 'object' &&
    !Array.isArray(row.payload)
      ? (row.payload as Record<string, unknown>)
      : row;
  const gameType = normalizeBoundedText(payload.gameType, 120);
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/.test(gameType)) {
    throw new BadRequestException('Type de jeu invalide');
  }
  const normalizedName = normalizeBoundedText(payload.name, 255);
  const name = normalizedName || null;
  const maxPlayersRaw = payload.maxPlayers ?? payload.max ?? null;
  const maxPlayers = parseStrictInteger(maxPlayersRaw, { min: 1, max: 100 });
  if (maxPlayersRaw !== null && maxPlayers === null) {
    throw new BadRequestException('Nombre de joueurs invalide');
  }
  const isPrivate =
    typeof payload.isPrivate === 'boolean' ? payload.isPrivate : false;

  return { gameType, name, maxPlayers, isPrivate };
}

export function parseRoomJoinRequest(
  row: Record<string, unknown>,
): RoomJoinRequest {
  const roomId = parseStrictInteger(row.roomId, { min: 1 });
  if (roomId === null) {
    throw new BadRequestException('Identifiant de room invalide');
  }
  const spectator = resolveTruthyFlag(row.spectator);
  const silent = resolveTruthyFlag(row.hidden);

  return { roomId, spectator, silent };
}

function normalizeBoundedText(value: unknown, maxLength: number): string {
  const normalized =
    typeof value === 'string' ? value.normalize('NFKC').trim() : '';
  if (normalized.length > maxLength || containsControlCharacter(normalized)) {
    throw new BadRequestException('Chaîne invalide');
  }
  return normalized;
}

function containsControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}

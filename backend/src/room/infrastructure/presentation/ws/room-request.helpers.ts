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
    row.payload && typeof row.payload === 'object'
      ? (row.payload as Record<string, unknown>)
      : row;
  const gameType =
    typeof payload.gameType === 'string' ? String(payload.gameType) : '';
  const name = typeof payload.name === 'string' ? String(payload.name) : null;
  const maxPlayersRaw = payload.maxPlayers ?? payload.max ?? null;
  const maxPlayers =
    typeof maxPlayersRaw === 'number'
      ? maxPlayersRaw
      : typeof maxPlayersRaw === 'string' &&
          Number.isFinite(parseInt(maxPlayersRaw, 10))
        ? parseInt(maxPlayersRaw, 10)
        : null;
  const isPrivate =
    typeof payload.isPrivate === 'boolean' ? payload.isPrivate : false;

  return { gameType, name, maxPlayers, isPrivate };
}

export function parseRoomJoinRequest(
  row: Record<string, unknown>,
): RoomJoinRequest {
  const roomId = Number(row.roomId ?? row.room ?? 0);
  const spectator = resolveTruthyFlag(row.spectator);
  const silent = resolveTruthyFlag(row.silent) || resolveTruthyFlag(row.hidden);

  return { roomId, spectator, silent };
}

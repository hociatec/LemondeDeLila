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
  const gameType = typeof row.gameType === 'string' ? String(row.gameType) : '';
  const name = typeof row.name === 'string' ? String(row.name) : null;
  const maxPlayersRaw = row.maxPlayers ?? row.max ?? null;
  const maxPlayers =
    typeof maxPlayersRaw === 'number'
      ? maxPlayersRaw
      : Number.isFinite(parseInt(String(maxPlayersRaw ?? ''), 10))
        ? parseInt(String(maxPlayersRaw ?? ''), 10)
        : null;
  const isPrivate = typeof row.isPrivate === 'boolean' ? row.isPrivate : false;

  return { gameType, name, maxPlayers, isPrivate };
}

export function parseRoomJoinRequest(
  row: Record<string, unknown>,
): RoomJoinRequest {
  const roomId = Number(row.roomId ?? row.room ?? 0);
  const spectator = resolveTruthyFlag(row.spectator);
  const silent =
    resolveTruthyFlag(row.silent) || resolveTruthyFlag(row.hidden);

  return { roomId, spectator, silent };
}

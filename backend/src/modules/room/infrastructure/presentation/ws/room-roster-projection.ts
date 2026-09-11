import type { RoomPayload } from '../../../application/models/room-payload.model';
import {
  addHiddenSelf,
  listConnectedPlayers,
  listVisibleSpectators,
  mergePlayers,
  type ClientMetaLike,
} from './room-roster';

export type RoomRosterOptions = {
  includeRealtimePlayers?: boolean;
  includeHiddenSelf?: { userId: number; username: string };
};

/** Derive the socket roster without changing the cached room payload. */
export function projectRoomRoster(
  source: RoomPayload,
  clients: Iterable<ClientMetaLike>,
  roomId: number,
  options: RoomRosterOptions = {},
): RoomPayload {
  const payload = structuredClone(source);
  const connected: ClientMetaLike[] = [];
  for (const client of clients) {
    if (connected.length >= 10_000) break;
    connected.push(client);
  }
  const room = payload.room;
  room.spectators = listVisibleSpectators(connected, roomId);
  const started =
    room.status.toLowerCase() === 'started' || Boolean(room.startedAt);
  if (!started && room.players.length && room.spectators.length) {
    const spectatorIds = new Set(room.spectators.map((player) => player.id));
    room.players = room.players.filter(
      (player) => !spectatorIds.has(player.id),
    );
  }
  const playerIds = new Set(room.players.map((player) => player.id));
  room.spectators = room.spectators.filter(
    (player) => !playerIds.has(player.id),
  );
  if (options.includeHiddenSelf)
    room.spectators = addHiddenSelf(room.spectators, options.includeHiddenSelf);
  if (options.includeRealtimePlayers)
    room.players = mergePlayers(
      room.players,
      listConnectedPlayers(connected, roomId),
    );
  room.counts.players = room.players.length;
  room.counts.spectators = room.spectators.length;
  return payload;
}

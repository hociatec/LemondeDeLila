import type { RoomPlayer } from '../../../application/models/room-payload.model';

export type ClientMetaLike = {
  roomId: number;
  role: 'participant' | 'spectator';
  silent: boolean;
  userId: number;
  username: string;
};

export function listVisibleSpectators(
  clients: Iterable<ClientMetaLike>,
  roomId: number,
): RoomPlayer[] {
  const unique = new Map<number, string>();
  for (const meta of clients) {
    if (meta.roomId !== roomId) continue;
    if (meta.role !== 'spectator') continue;
    if (meta.silent) continue;
    unique.set(meta.userId, meta.username || `User ${meta.userId}`);
  }
  return Array.from(unique.entries()).map(([id, username]) => ({
    id,
    username,
  }));
}

export function listConnectedPlayers(
  clients: Iterable<ClientMetaLike>,
  roomId: number,
): RoomPlayer[] {
  const unique = new Map<number, string>();
  for (const meta of clients) {
    if (meta.roomId !== roomId) continue;
    if (meta.role !== 'participant') continue;
    if (meta.silent) continue;
    unique.set(meta.userId, meta.username || `User ${meta.userId}`);
  }
  return Array.from(unique.entries()).map(([id, username]) => ({
    id,
    username,
  }));
}

export function mergePlayers(
  dbPlayers: RoomPlayer[] | null | undefined,
  connectedPlayers: RoomPlayer[] | null | undefined,
): RoomPlayer[] {
  const merged = new Map<number, string>();
  for (const p of dbPlayers ?? []) merged.set(p.id, p.username);
  for (const p of connectedPlayers ?? []) merged.set(p.id, p.username);
  return Array.from(merged.entries()).map(([id, username]) => ({
    id,
    username,
  }));
}

export function addHiddenSelf(
  spectators: RoomPlayer[],
  hiddenSelf: { userId: number; username: string } | null | undefined,
): RoomPlayer[] {
  if (!hiddenSelf) return spectators;
  const unique = new Map<number, string>();
  for (const s of spectators ?? []) unique.set(s.id, s.username);
  unique.set(hiddenSelf.userId, hiddenSelf.username);
  return Array.from(unique.entries()).map(([id, username]) => ({
    id,
    username,
  }));
}

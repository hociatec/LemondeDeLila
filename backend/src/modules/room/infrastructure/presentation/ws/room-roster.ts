import type { RoomPlayer } from '../../../application/models/room-payload.model';
import { asUserId } from '../../../../../shared/interfaces/public-api';

export type ClientMetaLike = {
  roomId: number;
  role: 'participant' | 'spectator';
  silent: boolean;
  userId: number;
  username: string;
};

const MAX_PLAYERS = 64;
const MAX_USERNAME_LENGTH = 255;

function validPlayerId(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function safeUsername(value: unknown, fallback: string): string {
  const username = typeof value === 'string' ? value.trim() : '';
  return (username || fallback).slice(0, MAX_USERNAME_LENGTH);
}

export function listVisibleSpectators(
  clients: Iterable<ClientMetaLike>,
  roomId: number,
): RoomPlayer[] {
  const unique = new Map<number, string>();
  for (const meta of clients) {
    if (!validPlayerId(meta.userId)) continue;
    if (unique.size >= MAX_PLAYERS && !unique.has(meta.userId)) continue;
    if (meta.roomId !== roomId) continue;
    if (meta.role !== 'spectator') continue;
    if (meta.silent) continue;
    unique.set(meta.userId, safeUsername(meta.username, `User ${meta.userId}`));
  }
  return Array.from(unique.entries()).map(([id, username]) => ({
    id: asUserId(id),
    username,
  }));
}

export function listConnectedPlayers(
  clients: Iterable<ClientMetaLike>,
  roomId: number,
): RoomPlayer[] {
  const unique = new Map<number, string>();
  for (const meta of clients) {
    if (!validPlayerId(meta.userId)) continue;
    if (unique.size >= MAX_PLAYERS && !unique.has(meta.userId)) continue;
    if (meta.roomId !== roomId) continue;
    if (meta.role !== 'participant') continue;
    if (meta.silent) continue;
    unique.set(meta.userId, safeUsername(meta.username, `User ${meta.userId}`));
  }
  return Array.from(unique.entries()).map(([id, username]) => ({
    id: asUserId(id),
    username,
  }));
}

export function mergePlayers(
  dbPlayers: RoomPlayer[] | null | undefined,
  connectedPlayers: RoomPlayer[] | null | undefined,
): RoomPlayer[] {
  const merged = new Map<number, string>();
  for (const p of (dbPlayers ?? []).slice(0, MAX_PLAYERS)) {
    if (!validPlayerId(p?.id)) continue;
    merged.set(p.id, safeUsername(p.username, `User ${p.id}`));
  }
  for (const p of (connectedPlayers ?? []).slice(0, MAX_PLAYERS)) {
    if (!validPlayerId(p?.id)) continue;
    if (merged.size < MAX_PLAYERS || merged.has(p.id)) {
      merged.set(p.id, safeUsername(p.username, `User ${p.id}`));
    }
  }
  return Array.from(merged.entries()).map(([id, username]) => ({
    id: asUserId(id),
    username,
  }));
}

export function addHiddenSelf(
  spectators: RoomPlayer[],
  hiddenSelf: { userId: number; username: string } | null | undefined,
): RoomPlayer[] {
  if (!hiddenSelf) return spectators;
  const unique = new Map<number, string>();
  for (const s of (spectators ?? []).slice(0, MAX_PLAYERS)) {
    if (!validPlayerId(s?.id)) continue;
    unique.set(s.id, safeUsername(s.username, `User ${s.id}`));
  }
  if (
    validPlayerId(hiddenSelf.userId) &&
    (unique.size < MAX_PLAYERS || unique.has(hiddenSelf.userId))
  ) {
    unique.set(
      hiddenSelf.userId,
      safeUsername(hiddenSelf.username, `User ${hiddenSelf.userId}`),
    );
  }
  return Array.from(unique.entries()).map(([id, username]) => ({
    id: asUserId(id),
    username,
  }));
}

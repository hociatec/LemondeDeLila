import type { RoomRecord } from '../models/room-record.model';
import { OPEN_ROOM_STATUSES } from '../models/room-status.model';

export function hasAdminRoomRole(roles: unknown): boolean {
  const list = Array.isArray(roles) ? roles : [];
  return list.includes('ROLE_ADMIN') || list.includes('admin');
}

export function getRoomManifestStatus(manifest: unknown): string {
  if (!manifest || typeof manifest !== 'object') {
    return 'finished';
  }
  const status = (manifest as { status?: unknown }).status;
  return String(status ?? 'finished').toLowerCase();
}

export function resolveRoomMaxPlayers(params: {
  requestedMaxPlayers?: number | null;
  defaultMaxPlayers?: number | null;
}): number {
  const requested = params.requestedMaxPlayers;
  if (requested && requested > 0) {
    return requested;
  }
  const fallback = params.defaultMaxPlayers;
  if (fallback && fallback > 0) {
    return fallback;
  }
  return 4;
}

export function resolveRoomName(params: {
  providedName?: string | null;
  gameType: string;
}): string {
  const trimmed = String(params.providedName ?? '').trim();
  return trimmed || `Table ${params.gameType}`;
}

export function normalizeExceptRoomId(exceptRoomId?: number): number {
  return typeof exceptRoomId === 'number' &&
    Number.isFinite(exceptRoomId) &&
    exceptRoomId > 0
    ? Math.floor(exceptRoomId)
    : 0;
}

export function isOpenRoom(room: RoomRecord): boolean {
  if (room.startedAt) {
    return false;
  }
  const status = String(room.status ?? '').toLowerCase();
  return OPEN_ROOM_STATUSES.includes(
    status as (typeof OPEN_ROOM_STATUSES)[number],
  );
}

export function isStartedRoom(room: RoomRecord): boolean {
  return (
    String(room.status ?? '').toLowerCase() === 'started' ||
    Boolean(room.startedAt)
  );
}

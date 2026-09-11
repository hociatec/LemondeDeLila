import type { RoomRecord } from '../../models/room-record.model';
import { resolveRoomLifecycleState } from '../../models/room-lifecycle-state.model';
import { stringOrEmpty } from '@shared/utils/public-api';

export function hasAdminRoomRole(roles: unknown): boolean {
  const list = Array.isArray(roles) ? roles : [];
  return list.includes('ROLE_ADMIN') || list.includes('admin');
}

export function getRoomManifestStatus(manifest: unknown): string {
  if (!manifest || typeof manifest !== 'object') {
    return 'finished';
  }
  const status = (manifest as { status?: unknown }).status;
  return (stringOrEmpty(status) || 'finished').toLowerCase();
}

export function resolveRoomMaxPlayers(params: {
  requestedMaxPlayers?: number | null;
  defaultMaxPlayers?: number | null;
}): number {
  const requested = params.requestedMaxPlayers;
  if (
    typeof requested === 'number' &&
    Number.isSafeInteger(requested) &&
    requested > 0
  ) {
    return Math.min(requested, 64);
  }
  const fallback = params.defaultMaxPlayers;
  if (
    typeof fallback === 'number' &&
    Number.isSafeInteger(fallback) &&
    fallback > 0
  ) {
    return Math.min(fallback, 64);
  }
  return 4;
}

export function resolveRoomName(params: {
  providedName?: string | null;
  gameType: string;
}): string {
  const trimmed =
    typeof params.providedName === 'string' ? params.providedName.trim() : '';
  return (trimmed || `Table ${params.gameType}`).slice(0, 255);
}

export function normalizeExceptRoomId(exceptRoomId?: number): number {
  return typeof exceptRoomId === 'number' &&
    Number.isSafeInteger(exceptRoomId) &&
    exceptRoomId > 0
    ? exceptRoomId
    : 0;
}

export function isOpenRoom(room: RoomRecord): boolean {
  return resolveRoomLifecycleState(room).kind === 'open';
}

export function isStartedRoom(room: RoomRecord): boolean {
  return resolveRoomLifecycleState(room).kind === 'started';
}
/** Room application capability boundary. */

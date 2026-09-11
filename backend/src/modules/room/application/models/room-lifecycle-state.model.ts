import { OPEN_ROOM_STATUSES } from './room-status.model';

export type RoomLifecycleState =
  | { kind: 'open' }
  | { kind: 'started' }
  | { kind: 'finished' };

export function resolveRoomLifecycleState(input: {
  status?: string | null;
  startedAt?: Date | string | null;
}): RoomLifecycleState {
  const status = String(input.status ?? '').toLowerCase();
  if (input.startedAt || status === 'started' || status === 'playing') return { kind: 'started' };
  if (OPEN_ROOM_STATUSES.includes(status as (typeof OPEN_ROOM_STATUSES)[number])) return { kind: 'open' };
  return { kind: 'finished' };
}

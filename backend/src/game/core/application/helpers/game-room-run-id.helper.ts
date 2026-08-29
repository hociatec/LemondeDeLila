import { stringOrEmpty } from '@shared/utils/public-api';

type RoomRunContext = {
  status?: unknown;
  runId?: unknown;
};

export function resolveGameStateRunId(room: RoomRunContext): number | null {
  if (typeof room.runId !== 'number' || !Number.isFinite(room.runId)) {
    return null;
  }

  const status = stringOrEmpty(room.status).trim().toLowerCase();
  if (status === 'started') return room.runId;
  if (status === 'setup') return Math.max(0, room.runId) + 1;
  return null;
}

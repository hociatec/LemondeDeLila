import { GameStateViolationError } from '../../../core/domain/errors/game-domain.errors';
import { assertSerializableState } from '../state/assert-serializable-state';
import type { ScheduledGameTask } from './scheduler-types';
import { isGameTimestamp } from './game-deadline';

export type {
  GameSchedulerState,
  ScheduledGameTask,
  SchedulerVisibility,
} from './scheduler-types';

export const SCHEDULED_TASK_SCHEMA_VERSION = 1;

export function assertScheduledTask(
  value: unknown,
  id: string,
): asserts value is ScheduledGameTask {
  const fail = (field: string): never => {
    throw new GameStateViolationError('Timer de jeu invalide', {
      taskId: id,
      field,
    });
  };
  assertSerializableState(value, `scheduler.tasks.${id}`);
  if (!isRecord(value)) return fail('task');
  if (!id.trim() || value.id !== id || id !== id.trim()) fail('id');
  if (
    value.schemaVersion !== undefined &&
    value.schemaVersion !== SCHEDULED_TASK_SCHEMA_VERSION
  )
    fail('schemaVersion');
  if (!isGameTimestamp(value.dueAtMs)) fail('dueAtMs');
  const visibility = value.visibility;
  if (
    !isRecord(visibility) ||
    !['public', 'private', 'internal'].includes(String(visibility.kind))
  )
    return fail('visibility');
  if (
    visibility.kind === 'private' &&
    (!Array.isArray(visibility.playerIds) ||
      !visibility.playerIds.every(
        (id: unknown) =>
          typeof id === 'number' && Number.isSafeInteger(id) && id > 0,
      ))
  )
    fail('visibility.playerIds');
  if (value.action === undefined) return;
  if (
    !isRecord(value.action) ||
    typeof value.action.type !== 'string' ||
    !value.action.type.trim()
  )
    return fail('action.type');
  for (const field of ['payload', 'meta']) {
    if (value.action[field] !== undefined && !isRecord(value.action[field]))
      fail(`action.${field}`);
  }
}

export function assertGameScheduler(value: unknown): void {
  if (!isRecord(value) || !isRecord(value.tasks)) {
    throw new GameStateViolationError('Planificateur de jeu invalide');
  }
  for (const [id, task] of Object.entries(value.tasks))
    assertScheduledTask(task, id);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

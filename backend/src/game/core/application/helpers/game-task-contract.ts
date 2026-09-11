import type { GameState } from '../models/game-state.model';
import { createHash } from 'node:crypto';
import type {
  GameScheduledTask,
  GameTaskStateIdentity,
} from '../ports/game-task-scheduler.port';
import { encodeStableIdentity } from './stable-identity';

export function gameTaskCommandId(
  task: GameScheduledTask,
  index: number,
): string {
  if (!Number.isSafeInteger(index) || index < 0 || index > 128) {
    throw new Error('Invalid game task command index');
  }
  const identity = encodeStableIdentity([
    task.key,
    task.roomRunId ?? null,
    task.restoreId ?? null,
    task.stateIdentity?.schemaVersion ?? null,
    task.stateIdentity?.contentVersion ?? null,
    task.stateIdentity?.rulesVersion ?? null,
    task.signature,
    task.generation,
    index,
  ]);
  return `automatic:${createHash('sha256').update(identity).digest('hex')}`;
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown, maximum = 512): value is string {
  return (
    typeof value === 'string' && value.length > 0 && value.length <= maximum
  );
}

function count(value: unknown, minimum = 0): value is number {
  return (
    typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum
  );
}

function identity(value: unknown): GameTaskStateIdentity {
  if (
    !record(value) ||
    !count(value.schemaVersion, 1) ||
    !text(value.contentVersion) ||
    !text(value.rulesVersion)
  ) {
    throw new Error('Invalid game task state identity');
  }
  return {
    schemaVersion: value.schemaVersion,
    contentVersion: value.contentVersion,
    rulesVersion: value.rulesVersion,
  };
}

export function gameTaskStateIdentity(
  state: GameState,
): GameTaskStateIdentity | null {
  const engine: unknown = (state as GameState & { engine?: unknown }).engine;
  if (
    engine == null ||
    (record(engine) &&
      engine.schemaVersion === undefined &&
      engine.contentVersion === undefined &&
      engine.rulesVersion === undefined)
  )
    return null;
  return identity(engine);
}

export function sameGameTaskStateIdentity(
  task: GameScheduledTask,
  state: GameState,
): boolean {
  const current = gameTaskStateIdentity(state);
  const previous = task.stateIdentity ?? null;
  return current === null
    ? previous === null
    : previous !== null &&
        current.schemaVersion === previous.schemaVersion &&
        current.contentVersion === previous.contentVersion &&
        current.rulesVersion === previous.rulesVersion;
}

/** Persisted queue data is untrusted until decoded, even when Job<T> is typed. */
export function decodeGameScheduledTask(value: unknown): GameScheduledTask {
  if (
    !record(value) ||
    !count(value.roomId, 1) ||
    !text(value.gameType, 128) ||
    value.key !== `game-realtime:${value.roomId}:${value.gameType}` ||
    !text(value.signature, 2048) ||
    !count(value.generation) ||
    !count(value.dueAtMs) ||
    value.dueAtMs > Number.MAX_SAFE_INTEGER ||
    (value.roomRunId != null && !count(value.roomRunId, 1)) ||
    (value.restoreId != null && !text(value.restoreId)) ||
    (value.correlationId !== undefined && !text(value.correlationId))
  ) {
    throw new Error('Invalid game scheduled task');
  }
  return {
    key: value.key,
    roomId: value.roomId,
    gameType: value.gameType,
    signature: value.signature,
    generation: value.generation,
    restoreId: value.restoreId,
    dueAtMs: value.dueAtMs,
    roomRunId: value.roomRunId,
    correlationId: value.correlationId,
    stateIdentity:
      value.stateIdentity == null ? null : identity(value.stateIdentity),
  };
}

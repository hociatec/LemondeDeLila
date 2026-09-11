import { createHash } from 'node:crypto';
import type { GameScheduledTask } from '../../application/ports/game-task-scheduler.port';
import { encodeStableIdentity } from '../../application/helpers/stable-identity';

/** A late producer must never delete a newer generation or a different run. */
export function isSupersededGameTask(
  candidate: GameScheduledTask,
  replacement: GameScheduledTask,
): boolean {
  return (
    candidate.key === replacement.key &&
    (candidate.roomRunId ?? null) === (replacement.roomRunId ?? null) &&
    (candidate.restoreId ?? null) === (replacement.restoreId ?? null) &&
    candidate.generation < replacement.generation &&
    (candidate.stateIdentity?.schemaVersion ?? null) ===
      (replacement.stateIdentity?.schemaVersion ?? null) &&
    (candidate.stateIdentity?.contentVersion ?? null) ===
      (replacement.stateIdentity?.contentVersion ?? null) &&
    (candidate.stateIdentity?.rulesVersion ?? null) ===
      (replacement.stateIdentity?.rulesVersion ?? null)
  );
}

/** Hash the complete identity: normalization must not merge distinct game keys. */
export function gameTaskJobId(task: GameScheduledTask): string {
  if (
    !task ||
    typeof task.key !== 'string' ||
    task.key.length === 0 ||
    task.key.length > 256
  ) {
    throw new Error('Invalid game task identity');
  }
  const identity = encodeStableIdentity([
    task.key,
    task.roomId,
    task.gameType,
    task.roomRunId ?? null,
    task.restoreId ?? null,
    task.generation,
    task.signature,
    task.stateIdentity?.schemaVersion ?? null,
    task.stateIdentity?.contentVersion ?? null,
    task.stateIdentity?.rulesVersion ?? null,
  ]);
  return `game-task--${createHash('sha256').update(identity).digest('hex')}`;
}

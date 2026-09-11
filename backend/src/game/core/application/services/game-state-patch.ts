import type { GameStatePatchOperation } from '../models/game-event.model';
import type { GameState } from '../models/game-state.model';
import { sameSerializableValue } from '../../../engine/runtime/state/serializable-value';
import { GameStateViolationError } from '../../domain/errors/game-domain.errors';
import { assertGameStatePatch } from './game-state-patch-contract';
const MAX_PATCH_OPERATIONS = 512;

export function createStatePatch(
  previous: GameState,
  next: GameState,
): GameStatePatchOperation[] {
  const before = previous as Record<keyof GameState, unknown>;
  const after = next as Record<keyof GameState, unknown>;
  const keys = new Set<keyof GameState>([
    ...(Object.keys(before) as Array<keyof GameState>),
    ...(Object.keys(after) as Array<keyof GameState>),
  ]);
  const patch: GameStatePatchOperation[] = [];
  for (const key of [...keys].sort()) {
    if (!(key in after)) {
      patch.push({ operation: 'remove', key });
    } else if (!sameSerializableValue(before[key], after[key])) {
      patch.push({ operation: 'set', key, value: structuredClone(after[key]) });
    }
  }
  if (patch.length > MAX_PATCH_OPERATIONS) {
    throw new GameStateViolationError('Game patch too large.');
  }
  return patch;
}

export function applyStatePatch(
  state: GameState,
  patch: readonly GameStatePatchOperation[],
): GameState {
  assertGameStatePatch(patch);
  const next = structuredClone(state) as Record<keyof GameState, unknown>;
  for (const operation of patch) {
    if (operation.operation === 'remove') delete next[operation.key];
    else next[operation.key] = structuredClone(operation.value);
  }
  return next as GameState;
}

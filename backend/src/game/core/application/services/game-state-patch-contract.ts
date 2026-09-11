import type { GameStatePatchOperation } from '../models/game-event.model';
import { GameStateViolationError } from '../../domain/errors/game-domain.errors';
import { assertSerializableState } from '../../../engine/runtime/state/assert-serializable-state';

export function assertGameStatePatch(
  value: unknown,
): asserts value is GameStatePatchOperation[] {
  assertSerializableState(value, 'patch');
  if (!Array.isArray(value) || value.length > 512) fail();
  for (const operation of value) {
    if (!operation || typeof operation !== 'object' || Array.isArray(operation))
      fail();
    const record = operation as Record<string, unknown>;
    if (
      typeof record.key !== 'string' ||
      !record.key ||
      ['__proto__', 'constructor', 'prototype'].includes(record.key)
    )
      fail();
    if (record.operation === 'set') {
      if (
        !Object.hasOwn(record, 'value') ||
        Object.keys(record).some(
          (key) => !['operation', 'key', 'value'].includes(key),
        )
      )
        fail();
    } else if (
      record.operation !== 'remove' ||
      Object.keys(record).some((key) => !['operation', 'key'].includes(key))
    )
      fail();
  }
}

function fail(): never {
  throw new GameStateViolationError('Invalid persisted game state patch.');
}

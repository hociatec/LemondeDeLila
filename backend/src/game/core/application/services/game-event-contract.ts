import type { GameEvent, GamePendingEvent } from '../models/game-event.model';
import { GameStateViolationError } from '../../domain/errors/game-domain.errors';
import { assertSerializableState } from '../../../engine/runtime/state/assert-serializable-state';

export const GAME_EVENT_SCHEMA_VERSION = 1;

/** Validate before cloning: cloning would erase an ORM entity's prototype. */
export function assertPendingGameEvent(event: GamePendingEvent): void {
  assertSerializableState(event, 'event');
  if (
    !event ||
    typeof event.type !== 'string' ||
    !event.type.trim() ||
    event.type.length > 128 ||
    !Number.isFinite(event.occurredAtMs) ||
    (event.actorId !== null && !Number.isSafeInteger(event.actorId)) ||
    !event.data ||
    typeof event.data !== 'object' ||
    Array.isArray(event.data) ||
    !event.visibility ||
    typeof event.visibility !== 'object'
  )
    fail();
  const visibility = event.visibility;
  switch (visibility.kind) {
    case 'public':
    case 'internal':
      return;
    case 'private':
      if (
        !Array.isArray(visibility.playerIds) ||
        !visibility.playerIds.every(Number.isSafeInteger)
      )
        fail();
      return;
    case 'split':
      if (
        !visibility.privateDataByPlayer ||
        typeof visibility.privateDataByPlayer !== 'object' ||
        Array.isArray(visibility.privateDataByPlayer)
      )
        fail();
      for (const [id, data] of Object.entries(visibility.privateDataByPlayer)) {
        if (
          !/^-?[1-9][0-9]*$/.test(id) ||
          !Number.isSafeInteger(Number(id)) ||
          !data ||
          typeof data !== 'object' ||
          Array.isArray(data)
        )
          fail();
      }
      return;
    default:
      fail();
  }
}

/** Historical events without a header have the original v1 format. */
export function assertStoredGameEvent(event: GameEvent): void {
  assertPendingGameEvent(event);
  const schemaVersion =
    event.schemaVersion === undefined ? 1 : event.schemaVersion;
  if (
    schemaVersion !== GAME_EVENT_SCHEMA_VERSION ||
    !Number.isSafeInteger(event.seq) ||
    event.seq < 1 ||
    !Number.isSafeInteger(event.version) ||
    event.version < 1
  )
    fail();
}

function fail(): never {
  throw new GameStateViolationError(
    'Invalid or unsupported game event contract.',
  );
}

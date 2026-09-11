import type { GamePendingEvent } from '../models/game-event.model';
import type { GameState } from '../models/game-state.model';
import { GameStateViolationError } from '../../domain/errors/game-domain.errors';
import { assertPendingGameEvent } from './game-event-contract';
type StateWithEventBuffer = GameState & {
  engine?: { pendingEvents?: GamePendingEvent[] };
};
const MAX_PENDING_EVENTS = 128;

export function appendPendingGameEvent(
  state: GameState,
  event: GamePendingEvent,
): void {
  assertPendingGameEvent(event);
  const runtime = state as StateWithEventBuffer;
  runtime.engine ??= {};
  runtime.engine.pendingEvents ??= [];
  if (runtime.engine.pendingEvents.length >= MAX_PENDING_EVENTS) {
    throw new GameStateViolationError('Too many pending game events.');
  }
  runtime.engine.pendingEvents.push(structuredClone(event));
}

export function drainPendingGameEvents(state: GameState): GamePendingEvent[] {
  const runtime = state as StateWithEventBuffer;
  const events = structuredClone(runtime.engine?.pendingEvents ?? []);
  if (runtime.engine) delete runtime.engine.pendingEvents;
  return events;
}

import type {
  GameEvent,
  GamePendingEvent,
  GameStatePatchOperation,
  GameTimeline,
} from '../models/game-event.model';
import type { GameStateEntity } from '../models/game-state.model';

type StateWithEventBuffer = GameStateEntity & {
  engine?: { pendingEvents?: GamePendingEvent[] };
};

export function appendPendingGameEvent(
  state: GameStateEntity,
  event: GamePendingEvent,
): void {
  const runtime = state as StateWithEventBuffer;
  runtime.engine ??= {};
  runtime.engine.pendingEvents ??= [];
  runtime.engine.pendingEvents.push(structuredClone(event));
}

export function drainPendingGameEvents(
  state: GameStateEntity,
): GamePendingEvent[] {
  const runtime = state as StateWithEventBuffer;
  const events = structuredClone(runtime.engine?.pendingEvents ?? []);
  if (runtime.engine) delete runtime.engine.pendingEvents;
  return events;
}

export function createStatePatch(
  previous: GameStateEntity,
  next: GameStateEntity,
): GameStatePatchOperation[] {
  const before = previous as Record<keyof GameStateEntity, unknown>;
  const after = next as Record<keyof GameStateEntity, unknown>;
  const keys = new Set<keyof GameStateEntity>([
    ...(Object.keys(before) as Array<keyof GameStateEntity>),
    ...(Object.keys(after) as Array<keyof GameStateEntity>),
  ]);
  const patch: GameStatePatchOperation[] = [];
  for (const key of [...keys].sort()) {
    if (!(key in after)) {
      patch.push({ operation: 'remove', key });
    } else if (!isDeepEqual(before[key], after[key])) {
      patch.push({ operation: 'set', key, value: structuredClone(after[key]) });
    }
  }
  return patch;
}

export function applyStatePatch(
  state: GameStateEntity,
  patch: readonly GameStatePatchOperation[],
): GameStateEntity {
  const next = structuredClone(state) as Record<keyof GameStateEntity, unknown>;
  for (const operation of patch) {
    if (operation.operation === 'remove') delete next[operation.key];
    else next[operation.key] = structuredClone(operation.value);
  }
  return next as GameStateEntity;
}

export function replayTimeline(
  timeline: GameTimeline,
  untilSequence = Number.POSITIVE_INFINITY,
): GameStateEntity {
  const snapshot =
    [...timeline.snapshots]
      .filter((candidate) => candidate.seq <= untilSequence)
      .sort((left, right) => right.seq - left.seq)[0] ?? timeline.initial;
  let state = structuredClone(snapshot.state);
  for (const event of timeline.events) {
    if (event.seq <= snapshot.seq || event.seq > untilSequence) continue;
    if (event.type !== 'engine.state.committed') continue;
    const patch = event.data.patch;
    if (!Array.isArray(patch)) continue;
    state = applyStatePatch(state, patch as GameStatePatchOperation[]);
  }
  return state;
}

export function sequenceEvents(input: {
  pending: readonly GamePendingEvent[];
  patch: readonly GameStatePatchOperation[];
  previousSequence: number;
  version: number;
  fallbackTimeMs: number;
}): GameEvent[] {
  const events = input.pending.map((event, index) => ({
    ...structuredClone(event),
    seq: input.previousSequence + index + 1,
    version: input.version,
  }));
  events.push({
    seq: input.previousSequence + events.length + 1,
    version: input.version,
    actorId: input.pending.at(-1)?.actorId ?? null,
    occurredAtMs: input.pending.at(-1)?.occurredAtMs ?? input.fallbackTimeMs,
    type: 'engine.state.committed',
    data: { patch: structuredClone(input.patch) },
  });
  return events;
}

function isDeepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

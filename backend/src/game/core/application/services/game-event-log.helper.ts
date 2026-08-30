import type {
  GameEvent,
  GamePendingEvent,
  GameSnapshot,
  GameStatePatchOperation,
  GameTimeline,
} from '../contracts/game-event.model';
import type { GameStateEntity } from '../contracts/game-state.model';
import type { GameSnapshotPolicy } from '../ports/game-event-store.port';
import { sameSerializableValue } from '../../../engine/runtime/state/serializable-value';
import { GameStateViolationError } from '../../domain/errors/game-domain.errors';

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
    } else if (!sameSerializableValue(before[key], after[key])) {
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
    data: {
      patch: structuredClone(input.patch),
      ...(typeof input.pending.at(-1)?.data.commandId === 'string'
        ? { commandId: input.pending.at(-1)?.data.commandId }
        : {}),
    },
    visibility: { kind: 'internal' },
  });
  return events;
}

export function createGameTimeline(state: GameStateEntity): GameTimeline {
  const initial = createGameSnapshot(state, 0);
  return { initial, events: [], snapshots: [initial] };
}

export function appendGameTimelineCommit(input: {
  timeline: GameTimeline;
  previous: GameStateEntity;
  next: GameStateEntity;
  pendingEvents: readonly GamePendingEvent[];
  occurredAtMs: number;
  snapshotPolicy: Readonly<GameSnapshotPolicy>;
}): GameTimeline {
  assertGameStateSize(input.next, input.snapshotPolicy.maxStateBytes);
  const timeline = structuredClone(input.timeline);
  const version = input.next.version ?? (input.previous.version ?? 0) + 1;
  timeline.events.push(
    ...sequenceEvents({
      pending: input.pendingEvents,
      patch: createStatePatch(input.previous, input.next),
      previousSequence: timeline.events.at(-1)?.seq ?? 0,
      version,
      fallbackTimeMs: input.occurredAtMs,
    }),
  );
  capturePeriodicSnapshot(timeline, input.next, input.snapshotPolicy);
  return timeline;
}

export function assertGameStateSize(
  state: GameStateEntity,
  maxStateBytes: number | null | undefined,
): void {
  const limit = positiveThreshold(maxStateBytes);
  if (limit == null) return;
  const bytes = Buffer.byteLength(JSON.stringify(state), 'utf8');
  if (bytes <= limit) return;
  throw new GameStateViolationError('État de partie trop volumineux', {
    reason: 'GAME_STATE_SIZE_LIMIT',
    bytes,
    maxStateBytes: limit,
  });
}

function createGameSnapshot(state: GameStateEntity, seq: number): GameSnapshot {
  return {
    seq,
    version: state.version ?? 1,
    state: structuredClone(state),
  };
}

function capturePeriodicSnapshot(
  timeline: GameTimeline,
  state: GameStateEntity,
  policy: Readonly<GameSnapshotPolicy>,
): void {
  const sequence = timeline.events.at(-1)?.seq ?? 0;
  const previous = timeline.snapshots.at(-1)?.seq ?? 0;
  const eventCount = sequence - previous;
  const everyEvents = positiveThreshold(policy.everyEvents);
  const maxEventBytes = positiveThreshold(policy.maxEventBytes);
  const reachedCount = everyEvents != null && eventCount >= everyEvents;
  const reachedSize =
    maxEventBytes != null &&
    Buffer.byteLength(
      JSON.stringify(timeline.events.filter((event) => event.seq > previous)),
      'utf8',
    ) >= maxEventBytes;
  if (!reachedCount && !reachedSize) return;
  timeline.snapshots.push(createGameSnapshot(state, sequence));
}

function positiveThreshold(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : null;
}

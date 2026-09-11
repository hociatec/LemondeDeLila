import type {
  GameEvent,
  GamePendingEvent,
  GameSnapshot,
  GameStatePatchOperation,
  GameTimeline,
} from '../models/game-event.model';
import type { GameState } from '../models/game-state.model';
import type { GameSnapshotPolicy } from '../ports/game-event-store.port';
import { GameStateViolationError } from '../../domain/errors/game-domain.errors';
import { assertGameStatePatch } from './game-state-patch-contract';
import { createStatePatch, applyStatePatch } from './game-state-patch';
import {
  assertPendingGameEvent,
  assertStoredGameEvent,
  GAME_EVENT_SCHEMA_VERSION,
} from './game-event-contract';
const MAX_PENDING_EVENTS = 128;
const MAX_PATCH_OPERATIONS = 512;
const MAX_TIMELINE_EVENTS = 100_000;
const MAX_TIMELINE_SNAPSHOTS = 1_000;

export function replayTimeline(
  timeline: GameTimeline,
  untilSequence = Number.POSITIVE_INFINITY,
): GameState {
  const snapshot =
    [...timeline.snapshots]
      .filter((candidate) => candidate.seq <= untilSequence)
      .sort((left, right) => right.seq - left.seq)[0] ?? timeline.initial;
  let state = structuredClone(snapshot.state);
  let sequence = snapshot.seq;
  const events = [...timeline.events].sort(
    (left, right) => left.seq - right.seq,
  );
  for (const event of events) {
    assertStoredGameEvent(event);
    if (event.seq <= snapshot.seq || event.seq > untilSequence) continue;
    if (event.seq !== sequence + 1)
      throw new GameStateViolationError(
        'Incomplete or duplicate game event sequence.',
      );
    sequence = event.seq;
    if (event.type !== 'engine.state.committed') continue;
    const patch = event.data.patch;
    if (!Array.isArray(patch))
      throw new GameStateViolationError('Missing committed state patch.');
    assertGameStatePatch(patch);
    state = applyStatePatch(state, patch);
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
  if (
    !Number.isSafeInteger(input.previousSequence) ||
    input.previousSequence < 0 ||
    !Number.isSafeInteger(input.previousSequence + input.pending.length + 1) ||
    !Number.isSafeInteger(input.version) ||
    input.version < 1 ||
    !Number.isFinite(input.fallbackTimeMs) ||
    input.pending.length > MAX_PENDING_EVENTS ||
    input.patch.length > MAX_PATCH_OPERATIONS
  ) {
    throw new GameStateViolationError('Invalid game event sequence.');
  }
  for (const event of input.pending) {
    assertPendingGameEvent(event);
    if (event.type === 'engine.state.committed')
      throw new GameStateViolationError('Reserved game commit event.');
  }
  assertGameStatePatch(input.patch);
  const events = input.pending.map((event, index) => ({
    ...structuredClone(event),
    seq: input.previousSequence + index + 1,
    version: input.version,
    schemaVersion: GAME_EVENT_SCHEMA_VERSION,
  }));
  events.push({
    schemaVersion: GAME_EVENT_SCHEMA_VERSION,
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

export function createGameTimeline(state: GameState): GameTimeline {
  const initial = createGameSnapshot(state, 0);
  return { initial, events: [], snapshots: [initial] };
}

export function appendGameTimelineCommit(input: {
  timeline: GameTimeline;
  previous: GameState;
  next: GameState;
  pendingEvents: readonly GamePendingEvent[];
  occurredAtMs: number;
  snapshotPolicy: Readonly<GameSnapshotPolicy>;
}): GameTimeline {
  if (
    input.timeline.events.length + input.pendingEvents.length + 1 >
    MAX_TIMELINE_EVENTS
  ) {
    throw new GameStateViolationError('Game timeline too long.');
  }
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
  state: GameState,
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

function createGameSnapshot(state: GameState, seq: number): GameSnapshot {
  return {
    seq,
    version: state.version ?? 1,
    state: structuredClone(state),
  };
}

function capturePeriodicSnapshot(
  timeline: GameTimeline,
  state: GameState,
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
  if (timeline.snapshots.length >= MAX_TIMELINE_SNAPSHOTS) {
    timeline.snapshots.shift();
  }
  timeline.snapshots.push(createGameSnapshot(state, sequence));
}

function positiveThreshold(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : null;
}

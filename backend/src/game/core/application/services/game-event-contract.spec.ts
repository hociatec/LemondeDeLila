import type {
  GamePendingEvent,
  GameTimeline,
} from '../models/game-event.model';
import type { GameState } from '../models/game-state.model';
import {
  appendGameTimelineCommit,
  createGameTimeline,
  replayTimeline,
  sequenceEvents,
} from './game-timeline';
import {
  appendPendingGameEvent,
  drainPendingGameEvents,
} from './game-event-buffer';
import { assertGameStatePatch } from './game-state-patch-contract';
import { GameContextEvents } from '../../../engine/runtime/events/game-context-events';

function pending(): GamePendingEvent {
  return {
    type: 'test.event',
    data: { value: 1 },
    actorId: 1,
    occurredAtMs: 0,
    visibility: { kind: 'public' },
  };
}
function state(): GameState {
  return { status: 'started', phase: 'before', log: [], version: 1 };
}
function timeline(): GameTimeline {
  return {
    ...createGameTimeline(state()),
    events: sequenceEvents({
      pending: [pending()],
      patch: [{ operation: 'set', key: 'phase', value: 'after' }],
      previousSequence: 0,
      version: 2,
      fallbackTimeMs: 0,
    }),
  };
}

it('rejects event buffer overflow without losing already queued events', () => {
  const source = state();
  for (let index = 0; index < 128; index++) {
    appendPendingGameEvent(source, { ...pending(), data: { index } });
  }
  expect(() => appendPendingGameEvent(source, pending())).toThrow('Too many');
  expect(
    drainPendingGameEvents(source).map((event) => event.data.index),
  ).toEqual(Array.from({ length: 128 }, (_, index) => index));
});

it('counts the whole commit against the timeline capacity before copying it', () => {
  const log = timeline();
  log.events = Array.from({ length: 99_999 }, () => log.events[0]);
  expect(() =>
    appendGameTimelineCommit({
      timeline: log,
      previous: state(),
      next: { ...state(), version: 2 },
      pendingEvents: [pending()],
      occurredAtMs: 0,
      snapshotPolicy: {},
    }),
  ).toThrow('timeline too long');
  expect(log.events).toHaveLength(99_999);
});

it('versions durable events independently of state version and reads historical v1 events', () => {
  const log = timeline();
  expect(log.events.map((event) => event.schemaVersion)).toEqual([1, 1]);
  expect(log.events.map((event) => event.version)).toEqual([2, 2]);
  for (const event of log.events) delete event.schemaVersion;
  expect(replayTimeline(log).phase).toBe('after');
  expect(log.events.every((event) => event.schemaVersion === undefined)).toBe(
    true,
  );
  log.events[1].schemaVersion = 2;
  expect(() => replayTimeline(log)).toThrow('unsupported');
});

it('replays by explicit sequence and refuses missing or duplicate records', () => {
  const log = timeline();
  log.events.reverse();
  expect(replayTimeline(log).phase).toBe('after');
  expect(replayTimeline(log, 1).phase).toBe('before');
  expect(() => replayTimeline({ ...log, events: [log.events[0]] })).toThrow(
    'sequence',
  );
  expect(() =>
    replayTimeline({ ...log, events: [log.events[1], ...log.events] }),
  ).toThrow('sequence');
});

it('rejects invalid commit payloads instead of returning a partial replay', () => {
  const log = timeline();
  delete log.events[1].data.patch;
  expect(() => replayTimeline(log)).toThrow('patch');
});

it.each([
  [{ operation: 'set', key: '__proto__', value: {} }],
  [{ operation: 'erase', key: 'phase' }],
  [{ operation: 'set', key: 'phase' }],
  [{ operation: 'remove', key: 'phase', ignored: true }],
  [{ operation: 'set', key: 'phase', value: NaN }],
])('rejects malformed state patches: %j', (patch) => {
  expect(() => assertGameStatePatch(patch)).toThrow();
});

it('rejects ORM-shaped instances before cloning and leaves state untouched', () => {
  const toJSON = jest.fn();
  class Entity {
    [key: string]: unknown;
    value = 1;
    toJSON = toJSON;
  }
  const source = state();
  expect(() =>
    appendPendingGameEvent(source, { ...pending(), data: new Entity() }),
  ).toThrow();
  expect(source).toEqual(state());
  expect(toJSON).not.toHaveBeenCalled();
  const events = new GameContextEvents([], () => '2026-09-11T00:00:00.000Z');
  expect(() => events.api.emit('test', new Entity())).toThrow();
  expect(events.consume()).toEqual([]);
});

it('captures data and visibility at emission instead of retaining mutable references', () => {
  const events = new GameContextEvents([], () => '2026-09-11T00:00:00.000Z');
  const data = { card: 'original' };
  const visibility = { kind: 'private' as const, playerIds: [1] };
  events.api.emit('test', data, visibility);
  data.card = 'changed';
  visibility.playerIds.push(2);
  expect(events.consume()).toEqual([
    {
      type: 'test',
      data: { card: 'original' },
      visibility: { kind: 'private', playerIds: [1] },
    },
  ]);
});

it('rejects sequence overflow before creating persisted events', () => {
  expect(() =>
    sequenceEvents({
      pending: [],
      patch: [],
      previousSequence: Number.MAX_SAFE_INTEGER,
      version: 1,
      fallbackTimeMs: 0,
    }),
  ).toThrow('sequence');
});

it('prevents game rules from injecting a persistence commit event', () => {
  expect(() =>
    sequenceEvents({
      pending: [
        { ...pending(), type: 'engine.state.committed', data: { patch: [] } },
      ],
      patch: [],
      previousSequence: 0,
      version: 2,
      fallbackTimeMs: 0,
    }),
  ).toThrow('Reserved');
});

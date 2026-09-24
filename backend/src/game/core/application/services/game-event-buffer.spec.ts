import type { GameState } from '../models/game-state.model';
import {
  MAX_PENDING_EVENTS,
  appendPendingGameEvent,
  drainPendingGameEvents,
} from './game-event-buffer';

it('rejects overflow without losing existing events and releases capacity when drained', () => {
  const state: GameState = { status: 'started', phase: 'playing', log: [] };
  for (let index = 0; index < MAX_PENDING_EVENTS; index++) {
    appendPendingGameEvent(state, {
      type: 'test.event',
      data: { index },
      visibility: { kind: 'public' },
      actorId: null,
      occurredAtMs: 1000,
    });
  }
  expect(() =>
    appendPendingGameEvent(state, {
      type: 'overflow',
      data: {},
      visibility: { kind: 'public' },
      actorId: null,
      occurredAtMs: 1000,
    }),
  ).toThrow('Too many pending game events');
  const drained = drainPendingGameEvents(state);
  expect(drained.map((event) => event.data.index)).toEqual(
    Array.from({ length: MAX_PENDING_EVENTS }, (_, index) => index),
  );
  expect(drainPendingGameEvents(state)).toEqual([]);
  appendPendingGameEvent(state, {
    type: 'next',
    data: {},
    visibility: { kind: 'public' },
    actorId: null,
    occurredAtMs: 1000,
  });
  expect(drainPendingGameEvents(state).map((event) => event.type)).toEqual([
    'next',
  ]);
});

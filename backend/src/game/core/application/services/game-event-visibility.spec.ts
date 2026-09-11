import type { GameEvent } from '../models/game-event.model';
import {
  projectGameEvent,
  projectPendingGameEvent,
} from './game-event-visibility';

function event(): GameEvent {
  return {
    type: 'test',
    data: { public: 'visible' },
    actorId: 1,
    occurredAtMs: 0,
    seq: 1,
    version: 2,
    visibility: { kind: 'public' },
  };
}

it('projects only the documented envelope fields, including normalized schema version', () => {
  const source = {
    ...event(),
    serverSecret: 'hidden',
    internalDebug: { secret: 1 },
  };
  expect(projectGameEvent(source, 1)).toEqual({
    type: 'test',
    data: { public: 'visible' },
    actorId: 1,
    occurredAtMs: 0,
    seq: 1,
    version: 2,
    schemaVersion: 1,
  });
  expect(projectPendingGameEvent(source, 1)).toEqual({
    type: 'test',
    data: { public: 'visible' },
    actorId: 1,
    occurredAtMs: 0,
  });
  expect(source).not.toHaveProperty('schemaVersion');
});

it('keeps internal events hidden and private events restricted to their recipients', () => {
  expect(
    projectGameEvent({ ...event(), visibility: { kind: 'internal' } }, 1),
  ).toBeNull();
  const privateEvent = {
    ...event(),
    visibility: { kind: 'private' as const, playerIds: [1] },
  };
  expect(projectGameEvent(privateEvent, 1)).not.toBeNull();
  expect(projectGameEvent(privateEvent, 2)).toBeNull();
  expect(projectGameEvent(privateEvent, null)).toBeNull();
});

it('merges only the viewer private data and returns detached copies', () => {
  const source: GameEvent = {
    ...event(),
    visibility: {
      kind: 'split',
      privateDataByPlayer: { 1: { card: 'ace' }, 2: { card: 'king' } },
    },
  };
  const projected = projectGameEvent(source, 1);
  expect(projected?.data).toEqual({ public: 'visible', card: 'ace' });
  expect(projectGameEvent(source, null)?.data).toEqual({ public: 'visible' });
  if (projected) projected.data.card = 'changed';
  expect(projectGameEvent(source, 1)?.data.card).toBe('ace');
});

it('rejects future versions before presenting them under the current protocol', () => {
  expect(() => projectGameEvent({ ...event(), schemaVersion: 2 }, 1)).toThrow(
    'unsupported',
  );
});

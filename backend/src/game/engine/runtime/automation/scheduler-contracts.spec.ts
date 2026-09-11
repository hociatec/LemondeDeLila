import {
  GameSchedulerController,
  createGameSchedulerState,
  nextScheduledAction,
} from './scheduler-kit';
import { assertGameScheduler } from './scheduler-contracts';

it('round-trips versioned tasks and consumes them only at the deadline', () => {
  let now = 100;
  const state = createGameSchedulerState();
  const scheduler = new GameSchedulerController(state, () => now);
  scheduler.schedule('turn', {
    afterMs: 25,
    action: { type: 'pass', payload: { player: 7 } },
  });
  const restored: typeof state = JSON.parse(JSON.stringify(state));
  assertGameScheduler(restored);
  expect(restored.tasks.turn.schemaVersion).toBe(1);
  const reader = new GameSchedulerController(restored, () => now);
  expect(reader.consume('turn')).toBe(false);
  now = 125;
  expect(reader.consume('turn')).toBe(true);
  expect(reader.consume('turn')).toBe(false);
});

it('treats prototype names as ordinary task identifiers', () => {
  const state = createGameSchedulerState();
  const scheduler = new GameSchedulerController(state, () => 0);
  expect(scheduler.has('toString')).toBe(false);
  expect(scheduler.cancel('__proto__')).toBe(false);
  scheduler.schedule('__proto__', { atMs: 0, action: { type: 'pass' } });
  expect(scheduler.has('__proto__')).toBe(true);
  expect(Object.getPrototypeOf(state.tasks)).toBe(Object.prototype);
  expect(scheduler.consume('__proto__')).toBe(true);
});

it('rejects non-persistable payloads without storing a partial task', () => {
  const state = createGameSchedulerState();
  const scheduler = new GameSchedulerController(state, () => 0);
  expect(() =>
    scheduler.schedule('bad', {
      action: { type: 'pass', payload: { run: () => {} } },
    }),
  ).toThrow();
  expect(state.tasks).toEqual({});
});

it('orders equal deadlines by code point independently of locale', () => {
  const state = createGameSchedulerState();
  const scheduler = new GameSchedulerController(state, () => 0);
  for (const id of ['z', 'A', 'a'])
    scheduler.schedule(id, { action: { type: 'pass' } });
  expect(nextScheduledAction(state)?.id).toBe('A');
});

it.each([
  { schemaVersion: 2 },
  { dueAtMs: NaN },
  { visibility: { kind: 'private', playerIds: ['7'] } },
  { action: { type: 'pass', payload: [] } },
])('rejects invalid restored task fields: %j', (overrides) => {
  expect(() =>
    assertGameScheduler({
      tasks: {
        task: {
          id: 'task',
          dueAtMs: 1,
          visibility: { kind: 'public' },
          ...overrides,
        },
      },
    }),
  ).toThrow();
});

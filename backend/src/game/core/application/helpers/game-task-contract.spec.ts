import {
  gameTaskCommandId,
  decodeGameScheduledTask,
  gameTaskStateIdentity,
} from './game-task-contract';
import type { GameState } from '../models/game-state.model';

const task = {
  key: 'game-realtime:12:example',
  roomId: 12,
  gameType: 'example',
  signature: 'pause',
  generation: 4,
  dueAtMs: 100,
};

it('keeps automatic receipt identifiers within the journal limit and separates restorations and rules', () => {
  const longTask = {
    ...task,
    key: task.key + 'x'.repeat(200),
    signature: 's'.repeat(2048),
    restoreId: 'restore-a',
    stateIdentity: { schemaVersion: 1, contentVersion: 'c', rulesVersion: 'r' },
  };
  const id = gameTaskCommandId(longTask, 0);
  expect(id.length).toBeLessThanOrEqual(128);
  expect(gameTaskCommandId({ ...longTask, dueAtMs: 999 }, 0)).toBe(id);
  expect(
    gameTaskCommandId({ ...longTask, restoreId: 'restore-b' }, 0),
  ).not.toBe(id);
  expect(
    gameTaskCommandId(
      {
        ...longTask,
        stateIdentity: { ...longTask.stateIdentity, rulesVersion: 'r2' },
      },
      0,
    ),
  ).not.toBe(id);
  expect(gameTaskCommandId(longTask, 1)).not.toBe(id);
});

it.each([
  { value: null },
  { value: [] },
  { value: { ...task, roomId: -1 } },
  { value: { ...task, key: 'other' } },
  { value: { ...task, generation: NaN } },
  { value: { ...task, dueAtMs: Infinity } },
  { value: { ...task, roomRunId: 0 } },
  { value: { ...task, stateIdentity: {} } },
  {
    value: { ...task, stateIdentity: { schemaVersion: 1, rulesVersion: 'r' } },
  },
])('rejects malformed persisted tasks: %j', ({ value }) => {
  expect(() => decodeGameScheduledTask(value)).toThrow();
});

it('normalizes historical tasks without inventing versions and detaches valid identities', () => {
  expect(decodeGameScheduledTask(task).stateIdentity).toBeNull();
  const stateIdentity = {
    schemaVersion: 1,
    contentVersion: 'content-1',
    rulesVersion: 'rules-1',
  };
  const result = decodeGameScheduledTask({ ...task, stateIdentity });
  stateIdentity.rulesVersion = 'changed';
  expect(result.stateIdentity?.rulesVersion).toBe('rules-1');
  expect(() =>
    gameTaskStateIdentity({
      engine: { schemaVersion: 1 },
    } as unknown as GameState),
  ).toThrow();
});

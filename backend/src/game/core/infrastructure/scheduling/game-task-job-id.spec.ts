import { gameTaskJobId, isSupersededGameTask } from './game-task-job-id';

it('only removes older generations of the same compatible run', () => {
  const task = {
    key: 'game-realtime:1:example',
    roomId: 1,
    gameType: 'example',
    signature: 'pause',
    generation: 4,
    roomRunId: 2,
    dueAtMs: 100,
    stateIdentity: { schemaVersion: 1, contentVersion: 'c', rulesVersion: 'r' },
  };
  expect(
    isSupersededGameTask(
      { ...task, generation: 3, signature: 'previous-turn' },
      task,
    ),
  ).toBe(true);
  for (const candidate of [
    task,
    { ...task, generation: 5 },
    { ...task, generation: 3, roomRunId: 1 },
    { ...task, generation: 3, stateIdentity: undefined },
    {
      ...task,
      generation: 3,
      stateIdentity: { ...task.stateIdentity, rulesVersion: 'r2' },
    },
  ])
    expect(isSupersededGameTask(candidate, task)).toBe(false);
});

it('deduplicates delivery identity while separating runs and unsanitized game keys', () => {
  const task = {
    key: 'game-realtime:1:game',
    roomId: 1,
    gameType: 'a.b',
    signature: 'pause',
    generation: 4,
    roomRunId: 1,
    dueAtMs: 100,
  };
  expect(gameTaskJobId(task)).toBe(
    gameTaskJobId({ ...task, dueAtMs: 200, correlationId: 'retry' }),
  );
  for (const distinct of [
    { ...task, roomRunId: 2 },
    { ...task, gameType: 'a-b' },
    { ...task, key: 'other' },
    { ...task, generation: 5 },
    { ...task, signature: 'other' },
    {
      ...task,
      stateIdentity: {
        schemaVersion: 1,
        contentVersion: 'c',
        rulesVersion: 'r',
      },
    },
  ])
    expect(gameTaskJobId(distinct)).not.toBe(gameTaskJobId(task));
});

it('separates every compatibility version in the persistent queue identity', () => {
  const task = {
    key: 'game-realtime:1:example',
    roomId: 1,
    gameType: 'example',
    signature: 'pause',
    generation: 4,
    dueAtMs: 100,
    stateIdentity: { schemaVersion: 1, contentVersion: 'c', rulesVersion: 'r' },
  };
  for (const stateIdentity of [
    { ...task.stateIdentity, schemaVersion: 2 },
    { ...task.stateIdentity, contentVersion: 'c2' },
    { ...task.stateIdentity, rulesVersion: 'r2' },
  ])
    expect(gameTaskJobId({ ...task, stateIdentity })).not.toBe(
      gameTaskJobId(task),
    );
});

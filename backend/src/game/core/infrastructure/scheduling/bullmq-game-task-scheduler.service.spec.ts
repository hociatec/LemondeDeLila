import { ConfigService } from '@nestjs/config';
import { DelayedError, Queue, UnrecoverableError, Worker } from 'bullmq';
import Redis from 'ioredis';
import { ApplicationShutdownService } from '../../../../platform/lifecycle/public-api';
import { BullmqGameTaskSchedulerService } from './bullmq-game-task-scheduler.service';
import type { GameEngineMetricsService } from '../../application/services/game-engine-metrics.service';
import { prometheusMetrics } from '../../../../platform/observability/public-api';

jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn(() => ({ on: jest.fn(), quit: jest.fn() })),
}));
jest.mock('bullmq', () => ({
  ...jest.requireActual<typeof import('bullmq')>('bullmq'),
  Queue: jest.fn(() => ({ close: jest.fn() })),
  Worker: jest.fn(() => ({ on: jest.fn(), close: jest.fn() })),
}));

function harness(nowMs = 1000, shutdown = new ApplicationShutdownService()) {
  jest.clearAllMocks();
  const metrics = {
    recordTimerExecution: jest.fn(),
    recordTimerFailure: jest.fn(),
  };
  const service = new BullmqGameTaskSchedulerService(
    new ConfigService({ GAME_TASK_REDIS_URL: 'redis://test' }),
    metrics as unknown as GameEngineMetricsService,
    { now: () => nowMs },
    shutdown,
  );
  const processor = jest.fn().mockResolvedValue(undefined);
  service.registerProcessor(processor);
  const worker = Worker as unknown as jest.Mock<
    unknown,
    [string, (job: unknown, token?: string) => Promise<void>, unknown]
  >;
  return { process: worker.mock.calls[0][1], processor, metrics };
}

const task = {
  key: 'game-realtime:12:example',
  roomId: 12,
  gameType: 'example',
  signature: 'pause',
  generation: 4,
  dueAtMs: 1,
};

it('records failed worker attempts even when the stored task is malformed', () => {
  const test = harness();
  const metric = jest
    .spyOn(prometheusMetrics, 'recordBullmqFailure')
    .mockImplementation(() => {});
  const worker = jest.mocked(Worker).mock.results[0].value as { on: jest.Mock };
  const failed = worker.on.mock.calls.find(
    ([event]) => event === 'failed',
  )?.[1] as (job: unknown, error: Error) => void;
  try {
    failed({ data: null, id: 'invalid' }, new Error('invalid task'));
    expect(metric).toHaveBeenCalledWith('game-engine-tasks');
    expect(test.metrics.recordTimerFailure).not.toHaveBeenCalled();
  } finally {
    metric.mockRestore();
  }
});

it('tracks accepted work in the drain and refuses a new delivery after shutdown', async () => {
  const shutdown = new ApplicationShutdownService();
  const test = harness(1000, shutdown);
  let finish!: () => void;
  test.processor.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const active = test.process({ data: task });
  shutdown.stopAccepting();
  await expect(test.process({ data: task })).rejects.toThrow('shutting down');
  expect(test.processor).toHaveBeenCalledTimes(1);
  let drained = false;
  const drain = shutdown.drain().then(() => {
    drained = true;
  });
  await Promise.resolve();
  expect(drained).toBe(false);
  finish();
  await Promise.all([active, drain]);
  expect(drained).toBe(true);
});

it('waits for the BullMQ worker before closing its queue and Redis connection', async () => {
  jest.clearAllMocks();
  const shutdown = new ApplicationShutdownService();
  const service = new BullmqGameTaskSchedulerService(
    new ConfigService({ GAME_TASK_REDIS_URL: 'redis://test' }),
    { recordTimerExecution: jest.fn() } as unknown as GameEngineMetricsService,
    { now: () => 1000 },
    shutdown,
  );
  service.registerProcessor(async () => undefined);
  const worker = (Worker as unknown as jest.Mock).mock.results[0].value as {
    close: jest.Mock;
  };
  const queue = (Queue as unknown as jest.Mock).mock.results[0].value as {
    close: jest.Mock;
  };
  const redis = (Redis as unknown as jest.Mock).mock.results[0].value as {
    quit: jest.Mock;
  };
  let finishJob!: () => void;
  worker.close.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finishJob = resolve;
      }),
  );
  const stopped = shutdown.stopSources();
  await Promise.resolve();
  expect(worker.close).toHaveBeenCalledTimes(1);
  expect(queue.close).not.toHaveBeenCalled();
  expect(redis.quit).not.toHaveBeenCalled();
  finishJob();
  await stopped;
  expect(redis.quit).not.toHaveBeenCalled();
  await service.onModuleDestroy();
  expect(worker.close).toHaveBeenCalledTimes(1);
  expect(queue.close).toHaveBeenCalledTimes(1);
  expect(redis.quit).toHaveBeenCalledTimes(1);
});

it.each([{ data: null }, { data: { ...task, dueAtMs: NaN } }])(
  'quarantines malformed persisted data before metrics and execution: %j',
  async (job) => {
    const test = harness();
    await expect(test.process(job)).rejects.toBeInstanceOf(UnrecoverableError);
    expect(test.processor).not.toHaveBeenCalled();
    expect(test.metrics.recordTimerExecution).not.toHaveBeenCalled();
  },
);

it('moves an early delivery back to delayed with its lock token instead of losing it through deduplication', async () => {
  const test = harness();
  const dueAtMs = 61000;
  const moveToDelayed = jest.fn().mockResolvedValue(undefined);
  await expect(
    test.process({ data: { ...task, dueAtMs }, moveToDelayed }, 'lock-token'),
  ).rejects.toBeInstanceOf(DelayedError);
  expect(moveToDelayed).toHaveBeenCalledWith(dueAtMs, 'lock-token');
  expect(test.processor).not.toHaveBeenCalled();
  expect(test.metrics.recordTimerExecution).not.toHaveBeenCalled();
});

it('dispatches a validated due task and records its execution', async () => {
  const test = harness();
  await test.process({ data: task });
  expect(test.processor).toHaveBeenCalledWith(expect.objectContaining(task));
  expect(test.metrics.recordTimerExecution).toHaveBeenCalledWith(
    'example',
    999,
  );
});

it('executes exactly at the injected deadline, independent of wall time', async () => {
  const test = harness(42);
  await test.process({ data: { ...task, dueAtMs: 42 } });
  expect(test.processor).toHaveBeenCalledTimes(1);
  expect(test.metrics.recordTimerExecution).toHaveBeenCalledWith('example', 0);
});

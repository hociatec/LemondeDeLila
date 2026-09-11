import { ConfigService } from '@nestjs/config';
import { DelayedError, Queue, UnrecoverableError, Worker } from 'bullmq';
import Redis from 'ioredis';
import { ApplicationShutdownService } from '../../../../platform/lifecycle/public-api';
import { BullmqGameTaskSchedulerService } from './bullmq-game-task-scheduler.service';
import type { GameEngineMetricsService } from '../../application/services/game-engine-metrics.service';

jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn(() => ({ on: jest.fn(), quit: jest.fn() })),
}));
jest.mock('bullmq', () => ({
  ...jest.requireActual<typeof import('bullmq')>('bullmq'),
  Queue: jest.fn(() => ({ close: jest.fn() })),
  Worker: jest.fn(() => ({ on: jest.fn(), close: jest.fn() })),
}));

function harness() {
  jest.clearAllMocks();
  const metrics = {
    recordTimerExecution: jest.fn(),
    recordTimerFailure: jest.fn(),
  };
  const service = new BullmqGameTaskSchedulerService(
    new ConfigService({ GAME_TASK_REDIS_URL: 'redis://test' }),
    metrics as unknown as GameEngineMetricsService,
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

it('waits for the BullMQ worker before closing its queue and Redis connection', async () => {
  jest.clearAllMocks();
  const shutdown = new ApplicationShutdownService();
  const service = new BullmqGameTaskSchedulerService(
    new ConfigService({ GAME_TASK_REDIS_URL: 'redis://test' }),
    { recordTimerExecution: jest.fn() } as unknown as GameEngineMetricsService,
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
  const dueAtMs = Date.now() + 60000;
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
    expect.any(Number),
  );
});

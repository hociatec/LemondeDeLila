import { ConfigService } from '@nestjs/config';
import { HealthCheckError } from '@nestjs/terminus';
import { Queue } from 'bullmq';
import type { RedisClientFactory } from '../../../../platform/redis/public-api';
import { BullmqHealthIndicator } from './bullmq.health';
import { REDIS_READINESS_TIMEOUT_MS } from './health-check-timeout';

jest.mock('bullmq', () => ({ Queue: jest.fn() }));

function fixture() {
  const queue = {
    getJobCounts: jest
      .fn()
      .mockResolvedValue({ waiting: 0, active: 0, delayed: 0, failed: 0 }),
    close: jest.fn().mockResolvedValue(undefined),
  };
  (Queue as unknown as jest.Mock).mockImplementation(() => queue);
  const connection = { disconnect: jest.fn() };
  const factory = { create: jest.fn(() => connection) };
  const health = new BullmqHealthIndicator(
    new ConfigService({ GAME_TASK_REDIS_URL: 'redis://tasks' }),
    factory as unknown as RedisClientFactory,
  );
  return { health, queue, connection };
}

it('reports the queue and always releases the probe connection', async () => {
  const { health, queue, connection } = fixture();
  await expect(health.check('bullmq')).resolves.toHaveProperty(
    'bullmq.status',
    'up',
  );
  expect(connection.disconnect).toHaveBeenCalledTimes(1);
  expect(queue.close).toHaveBeenCalledTimes(1);
});

it('keeps failed-job readiness policy active', async () => {
  const { health, queue, connection } = fixture();
  queue.getJobCounts.mockResolvedValue({
    waiting: 0,
    active: 0,
    delayed: 0,
    failed: 101,
  });
  await expect(health.check('bullmq')).rejects.toBeInstanceOf(HealthCheckError);
  expect(connection.disconnect).toHaveBeenCalledTimes(1);
});

it('bounds a stalled queue read without waiting for automatic reconnection', async () => {
  jest.useFakeTimers();
  try {
    const { health, queue, connection } = fixture();
    queue.getJobCounts.mockImplementation(() => new Promise(() => {}));
    const checked = expect(health.check('bullmq')).rejects.toBeInstanceOf(
      HealthCheckError,
    );
    await jest.advanceTimersByTimeAsync(REDIS_READINESS_TIMEOUT_MS);
    await checked;
    expect(connection.disconnect).toHaveBeenCalledTimes(1);
    expect(queue.close).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  } finally {
    jest.useRealTimers();
  }
});

it('bounds a stalled close and preserves the dependency failure', async () => {
  jest.useFakeTimers();
  try {
    const { health, queue } = fixture();
    queue.getJobCounts.mockRejectedValue(
      new Error('redis://secret:password@host'),
    );
    queue.close.mockImplementation(() => new Promise(() => {}));
    const checked = health.check('bullmq').catch((error: unknown) => error);
    await jest.advanceTimersByTimeAsync(REDIS_READINESS_TIMEOUT_MS);
    const error = await checked;
    expect(error).toBeInstanceOf(HealthCheckError);
    expect(JSON.stringify(error)).not.toMatch(/password|secret/);
    expect(jest.getTimerCount()).toBe(0);
  } finally {
    jest.useRealTimers();
  }
});

it('still closes the queue if disconnect itself fails', async () => {
  const { health, queue, connection } = fixture();
  connection.disconnect.mockImplementation(() => {
    throw new Error('cleanup');
  });
  await expect(health.check('bullmq')).resolves.toHaveProperty(
    'bullmq.status',
    'up',
  );
  expect(queue.close).toHaveBeenCalledTimes(1);
});

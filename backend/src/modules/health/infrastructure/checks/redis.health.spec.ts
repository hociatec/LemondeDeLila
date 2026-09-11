import { ConfigService } from '@nestjs/config';
import { HealthCheckError } from '@nestjs/terminus';
import type { RedisClientFactory } from '../../../../platform/redis/public-api';
import { RedisHealthIndicator } from './redis.health';
import { REDIS_READINESS_TIMEOUT_MS } from './health-check-timeout';

function fixture(values: Record<string, string>, failingUrl?: string) {
  const clients: ReturnType<typeof createClient>[] = [];
  function createClient(url: string) {
    return {
      connect: jest.fn().mockResolvedValue(undefined),
      ping: jest.fn(async () => {
        if (url === failingUrl) throw new Error('redis://secret:password@host');
        return 'PONG';
      }),
      disconnect: jest.fn(),
    };
  }
  const create = jest.fn((url: string) => {
    const client = createClient(url);
    clients.push(client);
    return client;
  });
  const health = new RedisHealthIndicator(new ConfigService(values), {
    create,
  } as unknown as RedisClientFactory);
  return { health, create, clients };
}

it('deduplicates shared Redis while checking every required capability', async () => {
  const { health, create, clients } = fixture({
    SESSION_STORE_REDIS_URL: 'redis://shared',
  });
  await expect(health.check('redis')).resolves.toEqual({
    redis: {
      status: 'up',
      capabilities: {
        sessions: 'up',
        rateLimit: 'up',
        presence: 'up',
        notifications: 'up',
        tasks: 'up',
      },
    },
  });
  expect(create).toHaveBeenCalledTimes(1);
  expect(clients[0].disconnect).toHaveBeenCalledTimes(1);
});

it.each([
  'SESSION_STORE_REDIS_URL',
  'RATE_LIMIT_REDIS_URL',
  'PRESENCE_REDIS_URL',
  'NOTIFICATION_REDIS_URL',
  'GAME_TASK_REDIS_URL',
])(
  'fails readiness when a separate required endpoint fails: %s',
  async (failedKey) => {
    const values = Object.fromEntries(
      [
        'SESSION_STORE_REDIS_URL',
        'RATE_LIMIT_REDIS_URL',
        'PRESENCE_REDIS_URL',
        'NOTIFICATION_REDIS_URL',
        'GAME_TASK_REDIS_URL',
      ].map((key) => [key, `redis://${key}`]),
    );
    const { health, create, clients } = fixture(values, values[failedKey]);
    await expect(health.check('redis')).rejects.toBeInstanceOf(
      HealthCheckError,
    );
    expect(create).toHaveBeenCalledTimes(5);
    expect(
      clients.every((client) => client.disconnect.mock.calls.length === 1),
    ).toBe(true);
  },
);

it('does not gate readiness on an unused legacy URL or the room projection cache', async () => {
  const { health, create } = fixture(
    {
      SESSION_STORE_REDIS_URL: 'redis://shared',
      GAME_TASK_REDIS_URL: 'redis://shared',
      GAME_ENGINE_STATE_REDIS_URL: 'redis://unused',
      ROOM_PAYLOAD_REDIS_URL: 'redis://cache',
    },
    'redis://unused',
  );
  await expect(health.check('redis')).resolves.toHaveProperty(
    'redis.status',
    'up',
  );
  expect(create).toHaveBeenCalledTimes(1);
});

it('fails closed for missing required configuration', async () => {
  const { health, create } = fixture({});
  await expect(health.check('redis')).rejects.toBeInstanceOf(HealthCheckError);
  expect(create).not.toHaveBeenCalled();
});

it('does not expose connection secrets in a health response', async () => {
  const { health } = fixture(
    { SESSION_STORE_REDIS_URL: 'redis://shared' },
    'redis://shared',
  );
  const error = await health.check('redis').catch((error: unknown) => error);
  expect(JSON.stringify(error)).not.toMatch(/secret|password|redis:\/\//);
});

it('bounds a stuck connection and disconnects it after the deadline', async () => {
  jest.useFakeTimers();
  try {
    const client = {
      connect: jest.fn(() => new Promise<void>(() => {})),
      ping: jest.fn(),
      disconnect: jest.fn(),
    };
    const create = jest.fn(() => client);
    const health = new RedisHealthIndicator(
      new ConfigService({ SESSION_STORE_REDIS_URL: 'redis://shared' }),
      { create } as unknown as RedisClientFactory,
    );
    const check = expect(health.check('redis')).rejects.toBeInstanceOf(
      HealthCheckError,
    );
    await jest.advanceTimersByTimeAsync(REDIS_READINESS_TIMEOUT_MS);
    await check;
    expect(client.disconnect).toHaveBeenCalledTimes(1);
    expect(client.ping).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  } finally {
    jest.useRealTimers();
  }
});

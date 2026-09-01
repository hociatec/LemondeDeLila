import type { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import { RedisClientFactory } from './redis-client.factory';
import { RedisRateLimitStorage } from './redis-rate-limit.storage';

describe('RedisRateLimitStorage', () => {
  it('maps the atomic Redis response to the throttler contract', async () => {
    const client = {
      eval: jest.fn(async () => [3, 1500, 1, 900]),
      status: 'ready',
      quit: jest.fn(async () => 'OK'),
    } as unknown as Redis;
    const factory = {
      create: jest.fn(() => client),
    } as unknown as RedisClientFactory;
    const config = {
      get: jest.fn((key: string) =>
        key === 'RATE_LIMIT_REDIS_URL' ? 'redis://127.0.0.1:6379/4' : undefined,
      ),
    } as unknown as ConfigService;
    const storage = new RedisRateLimitStorage(config, factory);

    await expect(
      storage.increment('key', 60_000, 2, 5000, 'default'),
    ).resolves.toEqual({
      totalHits: 3,
      timeToExpire: 2,
      isBlocked: true,
      timeToBlockExpire: 1,
    });
    expect(client.eval).toHaveBeenCalledWith(
      expect.any(String),
      2,
      'lila:throttle:default:key:hits',
      'lila:throttle:default:key:block',
      '60000',
      '2',
      '5000',
    );
    await storage.onApplicationShutdown();
    expect(client.quit).toHaveBeenCalled();
  });

  it('fails fast when no shared Redis endpoint is configured', () => {
    const config = { get: () => undefined } as unknown as ConfigService;
    const factory = {} as RedisClientFactory;
    expect(() => new RedisRateLimitStorage(config, factory)).toThrow(
      'RATE_LIMIT_REDIS_URL',
    );
  });
});

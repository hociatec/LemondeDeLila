import type { ConfigService } from '@nestjs/config';
import type { RedisRateLimitStorage } from '../redis/public-api';
import {
  createRateLimitOptions,
  rateLimitTracker,
} from './rate-limit-options.factory';

describe('rate limit options', () => {
  it('uses shared storage and converts the documented TTL seconds to milliseconds', () => {
    const config = {
      get: (key: string, fallback: number) =>
        key === 'RATE_LIMIT_TTL' ? 60 : fallback,
    } as ConfigService;
    const storage = {} as RedisRateLimitStorage;

    expect(createRateLimitOptions(config, storage)).toMatchObject({
      storage,
      throttlers: [{ ttl: 60_000, limit: 120 }],
    });
  });

  it('keys authenticated users before falling back to the trusted request IP', () => {
    expect(rateLimitTracker({ user: { id: 42 }, ip: '10.0.0.1' })).toBe(
      'user:42',
    );
    expect(rateLimitTracker({ ip: '10.0.0.1' })).toBe('ip:10.0.0.1');
  });
});

import type { ConfigService } from '@nestjs/config';
import type { ThrottlerModuleOptions } from '@nestjs/throttler';
import type { RedisRateLimitStorage } from '../redis/public-api';

export function createRateLimitOptions(
  config: ConfigService,
  storage: RedisRateLimitStorage,
): ThrottlerModuleOptions {
  return {
    storage,
    getTracker: (request) => rateLimitTracker(request),
    throttlers: [
      {
        ttl: config.get<number>('RATE_LIMIT_TTL', 60) * 1000,
        limit: config.get<number>('RATE_LIMIT_COUNT', 120),
      },
    ],
  };
}

export function rateLimitTracker(request: Record<string, unknown>): string {
  const user = request['user'];
  if (user && typeof user === 'object') {
    const id = (user as Record<string, unknown>)['id'];
    if (typeof id === 'number' || typeof id === 'string') return `user:${id}`;
  }
  const ip = request['ip'];
  return `ip:${typeof ip === 'string' && ip ? ip : 'unknown'}`;
}

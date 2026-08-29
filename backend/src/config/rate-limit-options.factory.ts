import type { ConfigService } from '@nestjs/config';
import type { ThrottlerModuleOptions } from '@nestjs/throttler';

export function createRateLimitOptions(
  config: ConfigService,
): ThrottlerModuleOptions {
  return [
    {
      ttl: config.get<number>('RATE_LIMIT_TTL', 60),
      limit: config.get<number>('RATE_LIMIT_COUNT', 120),
    },
  ];
}

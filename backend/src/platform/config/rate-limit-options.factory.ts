import type { ConfigService } from '@nestjs/config';
import type {
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';

export function createRateLimitOptions(
  config: ConfigService,
  storage: ThrottlerStorage,
): ThrottlerModuleOptions {
  const ttlSecondsRaw = Number(config.get<number>('RATE_LIMIT_TTL', 60));
  const limitRaw = Number(config.get<number>('RATE_LIMIT_COUNT', 120));
  const ttlSeconds =
    Number.isSafeInteger(ttlSecondsRaw) &&
    ttlSecondsRaw >= 1 &&
    ttlSecondsRaw <= 3_600
      ? ttlSecondsRaw
      : 60;
  const limit =
    Number.isSafeInteger(limitRaw) && limitRaw >= 1 && limitRaw <= 10_000
      ? limitRaw
      : 120;
  return {
    storage,
    getTracker: (request) => rateLimitTracker(request),
    throttlers: [
      {
        ttl: ttlSeconds * 1000,
        limit,
      },
    ],
  };
}

export function rateLimitTracker(request: Record<string, unknown>): string {
  const user = request['user'];
  if (user && typeof user === 'object') {
    const id = (user as Record<string, unknown>)['id'];
    if (
      (typeof id === 'number' && Number.isSafeInteger(id) && id > 0) ||
      (typeof id === 'string' && /^[1-9]\d{0,18}$/.test(id))
    ) {
      return `user:${id}`;
    }
  }
  const ip = request['ip'];
  const normalizedIp =
    typeof ip === 'string' && ip.trim() ? ip.trim().slice(0, 128) : 'unknown';
  return `ip:${normalizedIp}`;
}

import type { ConfigService } from '@nestjs/config';

/** Mirrors the URLs actually selected by the required application capabilities. */
export function redisReadinessTargets(config: ConfigService) {
  const session = config.get<string>('SESSION_STORE_REDIS_URL');
  return {
    sessions: session || config.get<string>('REDIS_URL'),
    rateLimit: config.get<string>('RATE_LIMIT_REDIS_URL') ?? session,
    presence: config.get<string>('PRESENCE_REDIS_URL') || session,
    notifications: config.get<string>('NOTIFICATION_REDIS_URL') || session,
    tasks:
      config.get<string>('GAME_TASK_REDIS_URL') ??
      config.get<string>('GAME_ENGINE_STATE_REDIS_URL') ??
      session,
  };
}

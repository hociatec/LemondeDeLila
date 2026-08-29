import { ConfigService } from '@nestjs/config';
import type { BotNameCacheConfig } from '../../application/ports/bot-name-cache-config.port';

export function createBotNameCacheConfig(
  config: ConfigService,
): BotNameCacheConfig {
  const ttlCandidate = Number(config.get<string>('BOT_NAMES_CACHE_TTL_MS'));
  return {
    namesCacheTtlMs:
      Number.isFinite(ttlCandidate) && ttlCandidate >= 0 ? ttlCandidate : 30000,
  };
}

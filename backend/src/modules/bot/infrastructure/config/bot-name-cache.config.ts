import { operationalSettings } from '../../../../platform/config/public-api';
import type { BotNameCacheConfig } from '../../application/ports/bot-name-cache-config.port';

export function createBotNameCacheConfig(): BotNameCacheConfig {
  return { namesCacheTtlMs: operationalSettings.botNamesCacheTtlMs };
}

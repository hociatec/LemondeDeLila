import { ConfigService } from '@nestjs/config';
import type { CatalogCacheConfig } from '../../application/ports/catalog-cache-config.port';

export function createCatalogCacheConfig(
  config: ConfigService,
): CatalogCacheConfig {
  const ttlCandidate = Number(config.get<string>('GAME_CATALOG_CACHE_TTL_MS'));
  return {
    ttlMs:
      Number.isFinite(ttlCandidate) && ttlCandidate >= 0 ? ttlCandidate : 30000,
  };
}

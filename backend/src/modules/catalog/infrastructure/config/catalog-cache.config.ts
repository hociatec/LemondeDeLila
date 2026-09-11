import { operationalSettings } from '../../../../platform/config/public-api';
import type { CatalogCacheConfig } from '../../application/ports/catalog-cache-config.port';

export function createCatalogCacheConfig(): CatalogCacheConfig {
  return { ttlMs: operationalSettings.catalogCacheTtlMs };
}

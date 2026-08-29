import { ConfigService } from '@nestjs/config';
import { CATALOG_CACHE_CONFIG } from '../application/ports/catalog-cache-config.port';
import { CATALOG_GAME_SOURCE_PORT } from '../application/ports/catalog-game-source.port';
import { CatalogCacheService } from '../application/services/catalog-cache.service';
import { CatalogMapperService } from '../application/services/catalog-mapper.service';
import { createCatalogCacheConfig } from '../infrastructure/config/catalog-cache.config';
import { CatalogGameRegistrySource } from '../infrastructure/game-registry/catalog-game-registry.source';

export const CATALOG_CORE_PROVIDERS = [
  {
    provide: CATALOG_CACHE_CONFIG,
    inject: [ConfigService],
    useFactory: createCatalogCacheConfig,
  },
  CatalogCacheService,
  CatalogMapperService,
  CatalogGameRegistrySource,
  {
    provide: CATALOG_GAME_SOURCE_PORT,
    useExisting: CatalogGameRegistrySource,
  },
];

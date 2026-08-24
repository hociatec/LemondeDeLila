export const CATALOG_CACHE_CONFIG = Symbol('CATALOG_CACHE_CONFIG');

export type CatalogCacheConfig = {
  ttlMs: number;
};

export interface AdminCatalogCachePort {
  clearCache(): void;
}

export const ADMIN_CATALOG_CACHE_PORT = Symbol('ADMIN_CATALOG_CACHE_PORT');

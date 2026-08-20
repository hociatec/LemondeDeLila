import { CatalogService } from '../services/catalog.service';
import { CatalogWsHandler } from '../ws/catalog-ws.handler';
import { CatalogWsRegistrar } from '../ws/catalog-ws.registrar';

export const CATALOG_MODULE_PROVIDERS = [
  CatalogService,
  CatalogWsHandler,
  CatalogWsRegistrar,
];

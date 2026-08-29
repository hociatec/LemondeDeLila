import { CatalogWsHandler } from '../infrastructure/presentation/ws/catalog-ws.handler';
import { CatalogWsRegistrar } from '../infrastructure/presentation/ws/catalog-ws.registrar';

export const CATALOG_PRESENTATION_PROVIDERS = [
  CatalogWsHandler,
  CatalogWsRegistrar,
];

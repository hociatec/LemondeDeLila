import { CATALOG_CORE_PROVIDERS } from './catalog.module.providers.core';
import { CATALOG_PRESENTATION_PROVIDERS } from './catalog.module.providers.presentation';
import { CATALOG_USE_CASE_PROVIDERS } from './catalog.module.providers.use-cases';

export const CATALOG_MODULE_PROVIDERS = [
  ...CATALOG_CORE_PROVIDERS,
  ...CATALOG_USE_CASE_PROVIDERS,
  ...CATALOG_PRESENTATION_PROVIDERS,
];

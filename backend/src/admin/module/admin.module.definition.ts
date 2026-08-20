import { ADMIN_MODULE_CONTROLLERS } from './admin.module.controllers';
import { ADMIN_MODULE_IMPORTS } from './admin.module.imports';
import { ADMIN_CORE_PROVIDERS } from './admin.module.providers.core';
import { ADMIN_PRESENTATION_PROVIDERS } from './admin.module.providers.presentation';
import { ADMIN_USE_CASE_PROVIDERS } from './admin.module.providers.use-cases';

export {
  ADMIN_MODULE_CONTROLLERS,
  ADMIN_MODULE_IMPORTS,
};

export const ADMIN_MODULE_PROVIDERS = [
  ...ADMIN_CORE_PROVIDERS,
  ...ADMIN_USE_CASE_PROVIDERS,
  ...ADMIN_PRESENTATION_PROVIDERS,
];

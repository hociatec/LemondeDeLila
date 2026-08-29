import { CLIENT_UPDATES_CORE_PROVIDERS } from './client-updates.module.providers.core';
import { CLIENT_UPDATES_PRESENTATION_PROVIDERS } from './client-updates.module.providers.presentation';
import { CLIENT_UPDATES_USE_CASE_PROVIDERS } from './client-updates.module.providers.use-cases';

export const CLIENT_UPDATES_MODULE_PROVIDERS = [
  ...CLIENT_UPDATES_CORE_PROVIDERS,
  ...CLIENT_UPDATES_USE_CASE_PROVIDERS,
  ...CLIENT_UPDATES_PRESENTATION_PROVIDERS,
];

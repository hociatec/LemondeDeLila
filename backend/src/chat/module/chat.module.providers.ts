import { CHAT_CORE_PROVIDERS } from './chat.module.providers.core';
import { CHAT_USE_CASE_PROVIDERS } from './chat.module.providers.use-cases';

export const CHAT_MODULE_PROVIDERS = [
  ...CHAT_CORE_PROVIDERS,
  ...CHAT_USE_CASE_PROVIDERS,
];

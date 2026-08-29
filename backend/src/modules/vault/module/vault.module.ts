import { Module } from '@nestjs/common';
import { VAULT_MODULE_IMPORTS } from './vault.module.imports';
import { VAULT_CORE_PROVIDERS } from './vault.module.providers.core';
import { VAULT_PRESENTATION_PROVIDERS } from './vault.module.providers.presentation';

@Module({
  imports: VAULT_MODULE_IMPORTS,
  providers: [...VAULT_CORE_PROVIDERS, ...VAULT_PRESENTATION_PROVIDERS],
  exports: VAULT_CORE_PROVIDERS,
})
export class VaultModule {}

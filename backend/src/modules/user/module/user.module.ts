import { Module } from '@nestjs/common';
import { USER_MODULE_IMPORTS } from './user.module.imports';
import { USER_CORE_PROVIDERS } from './user.module.providers.core';
import { USER_PRESENTATION_PROVIDERS } from './user.module.providers.presentation';

@Module({
  imports: USER_MODULE_IMPORTS,
  providers: [...USER_CORE_PROVIDERS, ...USER_PRESENTATION_PROVIDERS],
  exports: USER_CORE_PROVIDERS,
})
export class UserModule {}

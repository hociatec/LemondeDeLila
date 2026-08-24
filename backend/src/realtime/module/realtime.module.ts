import { Module } from '@nestjs/common';
import { REALTIME_MODULE_IMPORTS } from './realtime.module.imports';
import { REALTIME_CORE_PROVIDERS } from './realtime.module.providers.core';
import { REALTIME_PRESENTATION_PROVIDERS } from './realtime.module.providers.presentation';

@Module({
  imports: REALTIME_MODULE_IMPORTS,
  providers: [...REALTIME_CORE_PROVIDERS, ...REALTIME_PRESENTATION_PROVIDERS],
})
export class RealtimeModule {}

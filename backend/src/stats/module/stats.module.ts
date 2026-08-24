import { Module } from '@nestjs/common';
import { STATS_MODULE_IMPORTS } from './stats.module.imports';
import { STATS_CORE_PROVIDERS } from './stats.module.providers.core';
import { STATS_PRESENTATION_PROVIDERS } from './stats.module.providers.presentation';

@Module({
  imports: STATS_MODULE_IMPORTS,
  providers: [...STATS_CORE_PROVIDERS, ...STATS_PRESENTATION_PROVIDERS],
  exports: STATS_CORE_PROVIDERS,
})
export class StatsModule {}

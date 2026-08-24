import { Module } from '@nestjs/common';
import { HEALTH_MODULE_IMPORTS } from './health.module.imports';
import { HEALTH_CORE_PROVIDERS } from './health.module.providers.core';
import { HEALTH_PRESENTATION_CONTROLLERS } from './health.module.providers.presentation';

@Module({
  imports: HEALTH_MODULE_IMPORTS,
  controllers: HEALTH_PRESENTATION_CONTROLLERS,
  providers: HEALTH_CORE_PROVIDERS,
})
export class HealthModule {}

import { Module } from '@nestjs/common';
import { SOUNDS_MODULE_IMPORTS } from './sounds.module.imports';
import { SOUNDS_CORE_PROVIDERS } from './sounds.module.providers.core';
import { SOUNDS_PRESENTATION_CONTROLLERS } from './sounds.module.providers.presentation';

@Module({
  imports: SOUNDS_MODULE_IMPORTS,
  controllers: SOUNDS_PRESENTATION_CONTROLLERS,
  providers: SOUNDS_CORE_PROVIDERS,
  exports: [SOUNDS_CORE_PROVIDERS[0]],
})
export class SoundsModule {}

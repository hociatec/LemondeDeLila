import { Module } from '@nestjs/common';
import { PresenceService } from '../application/services/presence.service';
import { PRESENCE_MODULE_IMPORTS } from './presence.module.imports';
import { PRESENCE_CORE_PROVIDERS } from './presence.module.providers.core';
import { PRESENCE_PRESENTATION_PROVIDERS } from './presence.module.providers.presentation';

@Module({
  imports: PRESENCE_MODULE_IMPORTS,
  providers: [...PRESENCE_CORE_PROVIDERS, ...PRESENCE_PRESENTATION_PROVIDERS],
  exports: [PresenceService],
})
export class PresenceModule {}

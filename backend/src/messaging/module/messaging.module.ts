import { Module } from '@nestjs/common';
import { MESSAGING_MODULE_IMPORTS } from './messaging.module.imports';
import { MESSAGING_CORE_PROVIDERS } from './messaging.module.providers.core';
import { MESSAGING_PRESENTATION_PROVIDERS } from './messaging.module.providers.presentation';
import { PrivateMessagingService } from '../application/services/private-messaging.service';

@Module({
  imports: MESSAGING_MODULE_IMPORTS,
  providers: [
    ...MESSAGING_CORE_PROVIDERS,
    ...MESSAGING_PRESENTATION_PROVIDERS,
  ],
  exports: [PrivateMessagingService],
})
export class MessagingModule {}

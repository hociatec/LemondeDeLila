import { Module } from '@nestjs/common';
import {
  CLIENT_UPDATES_MODULE_CONTROLLERS,
  CLIENT_UPDATES_MODULE_EXPORTS,
  CLIENT_UPDATES_MODULE_PROVIDERS,
} from './client-updates.module.definition';

@Module({
  controllers: CLIENT_UPDATES_MODULE_CONTROLLERS,
  providers: CLIENT_UPDATES_MODULE_PROVIDERS,
  exports: CLIENT_UPDATES_MODULE_EXPORTS,
})
export class ClientUpdatesModule {}

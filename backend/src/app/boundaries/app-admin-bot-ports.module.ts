import { Global, Module } from '@nestjs/common';
import { ADMIN_BOT_PORT } from '../../modules/admin/public-api';
import { BotModule } from '../../modules/bot/composition-api';
import { GameModule } from '../../game/composition-api';
import { AppAdminBotAdapter } from './app-admin-bot.adapter';

@Global()
@Module({
  imports: [BotModule, GameModule],
  providers: [
    AppAdminBotAdapter,
    { provide: ADMIN_BOT_PORT, useExisting: AppAdminBotAdapter },
  ],
  exports: [ADMIN_BOT_PORT],
})
export class AppAdminBotPortsModule {}

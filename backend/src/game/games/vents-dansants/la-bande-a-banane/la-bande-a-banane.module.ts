import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../module/game-core.module';
import { BoardGameDeckKitModule } from '../../../module/board-game-kits.module';
import { BandeABananeActionService } from './application/services/la-bande-a-banane-action.service';
import { BandeABananeBotService } from './application/services/la-bande-a-banane-bot.service';
import { BandeABananePresenterService } from './application/services/la-bande-a-banane-presenter.service';
import { BandeABananeSetupService } from './application/services/la-bande-a-banane-setup.service';
import { BandeABananeService } from './application/services/la-bande-a-banane.service';

@Module({
  providers: [
    BandeABananeService,
    BandeABananeSetupService,
    BandeABananeActionService,
    BandeABananePresenterService,
    BandeABananeBotService,
  ],
  exports: [BandeABananeService],
})
export class BandeABananeModule {}






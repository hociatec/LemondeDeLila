import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { BoardGameDeckKitModule } from '../../../modules/game-kits/board-game-kits.module';
import { BandeABananeActionService } from './actions/la-bande-a-banane-action.service';
import { BandeABananeBotService } from './bots/la-bande-a-banane-bot.service';
import { BandeABananePresenterService } from './presenter/la-bande-a-banane-presenter.service';
import { BandeABananeSetupService } from './setup/la-bande-a-banane-setup.service';
import { BandeABananeService } from './la-bande-a-banane.service';

@Module({
  imports: [
    BoardGameDeckKitModule,
    GameCoreModule,
    GameRegistryModule,
    ],
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

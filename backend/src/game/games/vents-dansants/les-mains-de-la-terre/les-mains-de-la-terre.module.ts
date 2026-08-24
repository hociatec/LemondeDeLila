import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../module/game-core.module';
import { BoardGameDeckKitModule } from '../../../module/board-game-kits.module';
import { LesMainsActionService } from './application/services/les-mains-de-la-terre-action.service';
import { LesMainsDeLaTerreBotService } from './application/services/les-mains-de-la-terre-bot.service';
import { LesMainsDeLaTerreService } from './application/services/les-mains-de-la-terre.service';
import { LesMainsPresenterService } from './application/services/les-mains-de-la-terre-presenter.service';
import { LesMainsSetupService } from './application/services/les-mains-de-la-terre-setup.service';

@Module({
  providers: [
    LesMainsDeLaTerreService,
    LesMainsSetupService,
    LesMainsActionService,
    LesMainsPresenterService,
    LesMainsDeLaTerreBotService,
  ],
  exports: [LesMainsDeLaTerreService],
})
export class LesMainsDeLaTerreModule {}






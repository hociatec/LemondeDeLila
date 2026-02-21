import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { BoardGameDeckKitModule } from '../../../modules/game-kits/board-game-kits.module';
import { LesMainsActionService } from './actions/les-mains-de-la-terre-action.service';
import { LesMainsDeLaTerreBotService } from './bots/les-mains-de-la-terre-bot.service';
import { LesMainsDeLaTerreService } from './les-mains-de-la-terre.service';
import { LesMainsPresenterService } from './presenter/les-mains-de-la-terre-presenter.service';
import { LesMainsSetupService } from './setup/les-mains-de-la-terre-setup.service';

@Module({
  imports: [BoardGameDeckKitModule, GameCoreModule, GameRegistryModule],
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

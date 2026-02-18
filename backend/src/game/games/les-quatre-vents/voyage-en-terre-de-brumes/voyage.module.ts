import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { BoardGameDeckKitModule } from '../../../modules/game-kits/board-game-kits.module';
import { EngineServicesModule } from '../../../engine/services/engine-services.module';
import { VoyageService } from './voyage.service';
import { VoyageSetupService } from './setup/voyage-setup.service';
import { VoyageActionService } from './actions/voyage-action.service';
import { VoyagePresenterService } from './presenter/voyage-presenter.service';
import { VoyageBotService } from './bots/voyage-bot.service';

@Module({
  imports: [
    BoardGameDeckKitModule,
    GameCoreModule,
    GameRegistryModule,
    EngineServicesModule,
    ],
  providers: [
    VoyageService,
    VoyageSetupService,
    VoyageActionService,
    VoyagePresenterService,
    VoyageBotService,
  ],
  exports: [VoyageService],
})
export class VoyageModule {}

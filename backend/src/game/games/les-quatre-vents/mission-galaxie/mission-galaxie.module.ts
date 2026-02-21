import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { BoardGameDeckKitModule } from '../../../modules/game-kits/board-game-kits.module';
import { EngineServicesModule } from '../../../engine/services/engine-services.module';
import { MissionGalaxieService } from './mission-galaxie.service';
import { MissionGalaxieSetupService } from './setup/mission-galaxie-setup.service';
import { MissionGalaxieActionService } from './actions/mission-galaxie-action.service';
import { MissionGalaxiePresenterService } from './presenter/mission-galaxie-presenter.service';
import { MissionGalaxieBotService } from './bots/mission-galaxie-bot.service';

@Module({
  imports: [
    BoardGameDeckKitModule,
    GameCoreModule,
    GameRegistryModule,
    EngineServicesModule,
  ],
  providers: [
    MissionGalaxieService,
    MissionGalaxieSetupService,
    MissionGalaxieActionService,
    MissionGalaxiePresenterService,
    MissionGalaxieBotService,
  ],
  exports: [MissionGalaxieService],
})
export class MissionGalaxieModule {}

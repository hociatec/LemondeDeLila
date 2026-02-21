import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { BoardGameDeckKitModule } from '../../../modules/game-kits/board-game-kits.module';
import { EngineServicesModule } from '../../../engine/services/engine-services.module';
import { MonVillageService } from './mon-village-mon-histoire.service';
import { MonVillageSetupService } from './setup/mon-village-setup.service';
import { MonVillageActionService } from './actions/mon-village-action.service';
import { MonVillagePresenterService } from './presenter/mon-village-presenter.service';
import { MonVillageBotService } from './bots/mon-village-bot.service';

@Module({
  imports: [
    BoardGameDeckKitModule,
    GameCoreModule,
    GameRegistryModule,
    EngineServicesModule,
  ],
  providers: [
    MonVillageService,
    MonVillageSetupService,
    MonVillageActionService,
    MonVillagePresenterService,
    MonVillageBotService,
  ],
  exports: [MonVillageService],
})
export class MonVillageModule {}

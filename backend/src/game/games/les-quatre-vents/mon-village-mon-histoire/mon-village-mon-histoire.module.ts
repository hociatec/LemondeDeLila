import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { EngineServicesModule } from '../../../engine/services/engine-services.module';
import { RandomModule } from '../../../modules/random/random.module';
import { BoardModule } from '../../../modules/board/board.module';
import { TurnModule } from '../../../modules/turn/turn.module';
import { BotModule } from '../../../modules/bot/bot.module';
import { MonVillageService } from './mon-village-mon-histoire.service';
import { MonVillageSetupService } from './setup/mon-village-setup.service';
import { MonVillageActionService } from './actions/mon-village-action.service';
import { MonVillagePresenterService } from './presenter/mon-village-presenter.service';
import { MonVillageBotService } from './bots/mon-village-bot.service';

@Module({
  imports: [
    GameCoreModule,
    GameRegistryModule,
    EngineServicesModule,
    RandomModule,
    BoardModule,
    TurnModule,
    BotModule,
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

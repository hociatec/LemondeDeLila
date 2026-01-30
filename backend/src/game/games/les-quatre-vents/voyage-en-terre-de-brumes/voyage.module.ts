import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { EngineServicesModule } from '../../../engine/services/engine-services.module';
import { RandomModule } from '../../../modules/random/random.module';
import { TurnModule } from '../../../modules/turn/turn.module';
import { BoardModule } from '../../../modules/board/board.module';
import { BotModule } from '../../../modules/bot/bot.module';
import { VoyageService } from './voyage.service';
import { VoyageSetupService } from './setup/voyage-setup.service';
import { VoyageActionService } from './actions/voyage-action.service';
import { VoyagePresenterService } from './presenter/voyage-presenter.service';
import { VoyageBotService } from './bots/voyage-bot.service';

@Module({
  imports: [
    GameCoreModule,
    GameRegistryModule,
    EngineServicesModule,
    RandomModule,
    TurnModule,
    BoardModule,
    BotModule,
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


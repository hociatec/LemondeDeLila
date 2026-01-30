import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { EngineServicesModule } from '../../../engine/services/engine-services.module';
import { RandomModule } from '../../../modules/random/random.module';
import { TurnModule } from '../../../modules/turn/turn.module';
import { BoardModule } from '../../../modules/board/board.module';
import { BotModule } from '../../../modules/bot/bot.module';
import { SacAMalicesService } from './sac-a-malices.service';
import { SacAMalicesSetupService } from './setup/sac-a-malices-setup.service';
import { SacAMalicesActionService } from './actions/sac-a-malices-action.service';
import { SacAMalicesPresenterService } from './presenter/sac-a-malices-presenter.service';
import { SacAMalicesBotService } from './bots/sac-a-malices-bot.service';

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
    SacAMalicesService,
    SacAMalicesSetupService,
    SacAMalicesActionService,
    SacAMalicesPresenterService,
    SacAMalicesBotService,
  ],
  exports: [SacAMalicesService],
})
export class SacAMalicesModule {}


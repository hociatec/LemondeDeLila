import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { EngineServicesModule } from '../../../engine/services/engine-services.module';
import { RandomModule } from '../../../modules/random/random.module';
import { TurnModule } from '../../../modules/turn/turn.module';
import { BoardModule } from '../../../modules/board/board.module';
import { BotModule } from '../../../modules/bot/bot.module';
import { PrimalisService } from './primalis.service';
import { PrimalisSetupService } from './setup/primalis-setup.service';
import { PrimalisActionService } from './actions/primalis-action.service';
import { PrimalisPresenterService } from './presenter/primalis-presenter.service';
import { PrimalisBotService } from './bots/primalis-bot.service';

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
    PrimalisService,
    PrimalisSetupService,
    PrimalisActionService,
    PrimalisPresenterService,
    PrimalisBotService,
  ],
  exports: [PrimalisService],
})
export class PrimalisModule {}

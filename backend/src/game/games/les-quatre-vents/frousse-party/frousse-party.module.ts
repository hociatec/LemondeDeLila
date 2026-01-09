import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { EngineServicesModule } from '../../../engine/services/engine-services.module';
import { RandomModule } from '../../../modules/random/random.module';
import { TurnModule } from '../../../modules/turn/turn.module';
import { BoardModule } from '../../../modules/board/board.module';
import { BotModule } from '../../../modules/bot/bot.module';
import { FroussePartyService } from './frousse-party.service';
import { FrousseSetupService } from './setup/frousse-setup.service';
import { FrousseActionService } from './actions/frousse-action.service';
import { FroussePresenterService } from './presenter/frousse-presenter.service';
import { FrousseBotService } from './bots/frousse-bot.service';

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
    FroussePartyService,
    FrousseSetupService,
    FrousseActionService,
    FroussePresenterService,
    FrousseBotService,
  ],
  exports: [FroussePartyService],
})
export class FroussePartyModule {}

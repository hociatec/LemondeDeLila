import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { RandomModule } from '../../../modules/random/random.module';
import { TurnModule } from '../../../modules/turn/turn.module';
import { BotModule } from '../../../modules/bot/bot.module';
import { CaDerapeService } from './ca-derape.service';
import { CaSetupService } from './setup/ca.setup';
import { CaActionService } from './actions/ca-actions.service';
import { CaPresenterService } from './presenter/ca-presenter.service';
import { CaBotService } from './bots/ca-bot.service';

@Module({
  imports: [
    GameCoreModule,
    GameRegistryModule,
    RandomModule,
    TurnModule,
    BotModule,
  ],
  providers: [
    CaDerapeService,
    CaSetupService,
    CaActionService,
    CaPresenterService,
    CaBotService,
  ],
  exports: [CaDerapeService],
})
export class CaDerapeModule {}

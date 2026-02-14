import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { RandomModule } from '../../../modules/random/random.module';
import { TurnModule } from '../../../modules/turn/turn.module';
import { BoardModule } from '../../../modules/board/board.module';
import { BotModule } from '../../../modules/bot/bot.module';
import { DeckPoliciesModule } from '../../../modules/deck-policies/deck-policies.module';
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
    BoardModule,
    BotModule,
    DeckPoliciesModule,
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

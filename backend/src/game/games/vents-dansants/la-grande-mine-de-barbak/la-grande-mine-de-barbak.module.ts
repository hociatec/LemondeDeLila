import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/core.module';
import { CardsModule } from '../../../modules/cards/cards.module';
import { TurnModule } from '../../../modules/turn/turn.module';
import { BoardModule } from '../../../modules/board/board.module';
import { EffectsModule } from '../../../modules/effects/effects.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { EngineServicesModule } from '../../../engine/services/engine-services.module';
import { PlayerModule } from '../../../modules/player/player.module';
import { ActionResolverModule } from '../../../modules/action-resolver/action-resolver.module';
import { ActionLogModule } from '../../../modules/actionlog/actionlog.module';
import { QuizModule } from '../../../modules/quiz/quiz.module';
import { ExchangeModule } from '../../../modules/exchange/exchange.module';
import { VictoryModule } from '../../../modules/victory/victory.module';
import { BotModule } from '../../../modules/bot/bot.module';
import { RandomModule } from '../../../modules/random/random.module';
import { LaGrandeMineDeBarbakService } from './la-grande-mine-de-barbak.service';
import { LaGrandeMineSetupService } from './setup/la-grande-mine-de-barbak-setup.service';
import { LaGrandeMineActionService } from './actions/la-grande-mine-de-barbak-action.service';
import { LaGrandeMinePresenterService } from './presenter/la-grande-mine-de-barbak-presenter.service';
import { LaGrandeMineBotService } from './bots/la-grande-mine-de-barbak-bot.service';
import { LaGrandeMinePhaseService } from './phases/la-grande-mine-de-barbak-phase.service';

@Module({
  imports: [
    GameCoreModule,
    CardsModule,
    TurnModule,
    BoardModule,
    EffectsModule,
    GameRegistryModule,
    EngineServicesModule,
    PlayerModule,
    ActionResolverModule,
    ActionLogModule,
    QuizModule,
    ExchangeModule,
    VictoryModule,
    BotModule,
    RandomModule,
  ],
  providers: [
    LaGrandeMineDeBarbakService,
    LaGrandeMineSetupService,
    LaGrandeMineActionService,
    LaGrandeMinePresenterService,
    LaGrandeMineBotService,
    LaGrandeMinePhaseService,
  ],
  exports: [
    LaGrandeMineDeBarbakService,
    LaGrandeMineSetupService,
    LaGrandeMineActionService,
    LaGrandeMinePresenterService,
    LaGrandeMineBotService,
    LaGrandeMinePhaseService,
  ],
})
export class LaGrandeMineDeBarbakModule {}

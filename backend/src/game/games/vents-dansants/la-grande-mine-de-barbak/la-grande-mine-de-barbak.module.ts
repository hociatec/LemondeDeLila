import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/core.module';
import { CardsModule } from '../../../modules/cards/cards.module';
import { EffectsModule } from '../../../modules/effects/effects.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { BoardGameDeckKitModule } from '../../../modules/game-kits/board-game-kits.module';
import { EngineServicesModule } from '../../../engine/services/engine-services.module';
import { PlayerModule } from '../../../modules/player/player.module';
import { ActionResolverModule } from '../../../modules/action-resolver/action-resolver.module';
import { ActionLogModule } from '../../../modules/actionlog/actionlog.module';
import { QuizModule } from '../../../modules/quiz/quiz.module';
import { ExchangeModule } from '../../../modules/exchange/exchange.module';
import { VictoryModule } from '../../../modules/victory/victory.module';
import { LaGrandeMineDeBarbakService } from './la-grande-mine-de-barbak.service';
import { LaGrandeMineSetupService } from './setup/la-grande-mine-de-barbak-setup.service';
import { LaGrandeMineDeBarbakActionService } from './actions/la-grande-mine-de-barbak-action.service';
import { LaGrandeMineDeBarbakPresenterService } from './presenter/la-grande-mine-de-barbak-presenter.service';
import { LaGrandeMineDeBarbakBotService } from './bots/la-grande-mine-de-barbak-bot.service';
import { LaGrandeMineDeBarbakPhaseService } from './phases/la-grande-mine-de-barbak-phase.service';

@Module({
  imports: [
    BoardGameDeckKitModule,
    GameCoreModule,
    CardsModule,
    EffectsModule,
    GameRegistryModule,
    EngineServicesModule,
    PlayerModule,
    ActionResolverModule,
    ActionLogModule,
    QuizModule,
    ExchangeModule,
    VictoryModule,
    ],
  providers: [
    LaGrandeMineDeBarbakService,
    LaGrandeMineSetupService,
    LaGrandeMineDeBarbakActionService,
    LaGrandeMineDeBarbakPresenterService,
    LaGrandeMineDeBarbakBotService,
    LaGrandeMineDeBarbakPhaseService,
  ],
  exports: [
    LaGrandeMineDeBarbakService,
    LaGrandeMineSetupService,
    LaGrandeMineDeBarbakActionService,
    LaGrandeMineDeBarbakPresenterService,
    LaGrandeMineDeBarbakBotService,
    LaGrandeMineDeBarbakPhaseService,
  ],
})
export class LaGrandeMineDeBarbakModule {}

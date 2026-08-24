import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../module/game-core.module';
import { CardsModule } from '../../../application/modules/cards.module';
import { EffectsModule } from '../../../application/modules/effects.module';
import { BoardGameDeckKitModule } from '../../../module/board-game-kits.module';
import { EngineServicesModule } from '../../../infrastructure/module/engine-services.module';
import { PlayerModule } from '../../../application/modules/player.module';
import { ActionResolverModule } from '../../../application/modules/action-resolver.module';
import { ActionLogModule } from '../../../application/modules/actionlog.module';
import { QuizModule } from '../../../application/modules/quiz.module';
import { ExchangeModule } from '../../../application/modules/exchange.module';
import { VictoryModule } from '../../../application/modules/victory.module';
import { LaGrandeMineDeBarbakService } from './application/services/la-grande-mine-de-barbak.service';
import { LaGrandeMineSetupService } from './application/services/la-grande-mine-de-barbak-setup.service';
import { LaGrandeMineDeBarbakActionService } from './application/services/la-grande-mine-de-barbak-action.service';
import { LaGrandeMineDeBarbakPresenterService } from './application/services/la-grande-mine-de-barbak-presenter.service';
import { LaGrandeMineDeBarbakBotService } from './application/services/la-grande-mine-de-barbak-bot.service';
import { LaGrandeMineDeBarbakPhaseService } from './application/services/la-grande-mine-de-barbak-phase.service';

@Module({
  imports: [
    BoardGameDeckKitModule,
    GameCoreModule,
    CardsModule,
    EffectsModule,
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







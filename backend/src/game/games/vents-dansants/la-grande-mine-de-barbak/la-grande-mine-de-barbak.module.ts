import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/infrastructure/module/game-core.module';
import { CardsModule } from '../../../cards/public-api';
import { EffectsModule } from '../../../effects/infrastructure/effects.module';
import { BoardGameDeckKitModule } from '../../../composition/board-game-kits.module';
import { EngineServicesModule } from '../../../core/infrastructure/module/engine-services.module';
import { PlayerModule } from '../../../core/infrastructure/module/player.module';
import { ActionResolverModule } from '../../../action-resolver/infrastructure/action-resolver.module';
import { ActionLogModule } from '../../../actionlog/infrastructure/actionlog.module';
import { QuizModule } from '../../../quiz/infrastructure/quiz.module';
import { ExchangeModule } from '../../../exchange/infrastructure/exchange.module';
import { VictoryModule } from '../../../victory/infrastructure/victory.module';
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







import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/infrastructure/module/game-core.module';
import { CardsModule } from '../../../cards/public-api';
import { EffectsModule } from '../../../effects/infrastructure/effects.module';
import { BoardGameCoreKitModule } from '../../../composition/board-game-kits.module';
import { EngineServicesModule } from '../../../core/infrastructure/module/engine-services.module';
import { PlayerModule } from '../../../core/infrastructure/module/player.module';
import { ActionResolverModule } from '../../../action-resolver/infrastructure/action-resolver.module';
import { ActionLogModule } from '../../../actionlog/infrastructure/actionlog.module';
import { QuizModule } from '../../../quiz/infrastructure/quiz.module';
import { ExchangeModule } from '../../../exchange/infrastructure/exchange.module';
import { VictoryModule } from '../../../victory/infrastructure/victory.module';
import { SetupFlowModule } from '../../../core/infrastructure/module/setup-flow.module';
import { PanierExpressService } from './application/services/panier-express.service';
import { PanierExpressSetupService } from './application/services/panier-express-setup.service';
import { PanierExpressDrawService } from './application/services/panier-express-draw.service';
import { PanierExpressQuizService } from './application/services/panier-express-quiz.service';
import { PanierExpressExchangeService } from './application/services/panier-express-exchange.service';
import { PanierExpressUtils } from './application/services/panier-express-utils.service';
import { PanierExpressDeckService } from './application/services/panier-express-deck.service';
import { PanierExpressBotService } from './application/services/panier-express-bot.service';
import { PanierExpressPhaseService } from './application/services/panier-express-phase.service';
import { PanierExpressPresenterService } from './application/services/panier-express-presenter.service';
import { PanierExpressStateService } from './application/services/panier-express-state.service';

@Module({
  imports: [
    BoardGameCoreKitModule,
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
    SetupFlowModule,
  ],
  providers: [
    PanierExpressService,
    PanierExpressSetupService,
    PanierExpressDrawService,
    PanierExpressQuizService,
    PanierExpressExchangeService,
    PanierExpressUtils,
    PanierExpressDeckService,
    PanierExpressBotService,
    PanierExpressPhaseService,
    PanierExpressPresenterService,
    PanierExpressStateService,
  ],
  exports: [
    PanierExpressService,
    PanierExpressSetupService,
    PanierExpressDrawService,
    PanierExpressQuizService,
    PanierExpressExchangeService,
    PanierExpressUtils,
    PanierExpressDeckService,
    PanierExpressBotService,
    PanierExpressPhaseService,
    PanierExpressPresenterService,
    PanierExpressStateService,
  ],
})
export class PanierExpressModule {}







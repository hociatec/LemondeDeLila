import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../module/game-core.module';
import { CardsModule } from '../../../application/modules/cards.module';
import { EffectsModule } from '../../../application/modules/effects.module';
import { BoardGameCoreKitModule } from '../../../module/board-game-kits.module';
import { EngineServicesModule } from '../../../infrastructure/module/engine-services.module';
import { PlayerModule } from '../../../application/modules/player.module';
import { ActionResolverModule } from '../../../application/modules/action-resolver.module';
import { ActionLogModule } from '../../../application/modules/actionlog.module';
import { QuizModule } from '../../../application/modules/quiz.module';
import { ExchangeModule } from '../../../application/modules/exchange.module';
import { VictoryModule } from '../../../application/modules/victory.module';
import { SetupFlowModule } from '../../../application/modules/setup-flow.module';
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







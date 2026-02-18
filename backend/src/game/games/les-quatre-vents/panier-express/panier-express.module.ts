import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/core.module';
import { CardsModule } from '../../../modules/cards/cards.module';
import { EffectsModule } from '../../../modules/effects/effects.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { BoardGameCoreKitModule } from '../../../modules/game-kits/board-game-kits.module';
import { EngineServicesModule } from '../../../engine/services/engine-services.module';
import { PlayerModule } from '../../../modules/player/player.module';
import { ActionResolverModule } from '../../../modules/action-resolver/action-resolver.module';
import { ActionLogModule } from '../../../modules/actionlog/actionlog.module';
import { QuizModule } from '../../../modules/quiz/quiz.module';
import { ExchangeModule } from '../../../modules/exchange/exchange.module';
import { VictoryModule } from '../../../modules/victory/victory.module';
import { PanierExpressService } from './panier-express.service';
import { PanierExpressSetupService } from './setup/panier-express-setup.service';
import { PanierExpressDrawService } from './actions/panier-express-draw.service';
import { PanierExpressQuizService } from './actions/panier-express-quiz.service';
import { PanierExpressExchangeService } from './actions/panier-express-exchange.service';
import { PanierExpressUtils } from './model/panier-express-utils.service';
import { PanierExpressDeckService } from './actions/panier-express-deck.service';
import { PanierExpressBotService } from './bots/panier-express-bot.service';
import { PanierExpressPhaseService } from './phases/panier-express-phase.service';
import { PanierExpressPresenterService } from './presenter/panier-express-presenter.service';

@Module({
  imports: [
    BoardGameCoreKitModule,
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
  ],
})
export class PanierExpressModule {}

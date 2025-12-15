import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../../core/core.module';
import { CardsModule } from '../../../../modules/cards/cards.module';
import { TurnModule } from '../../../../modules/turn/turn.module';
import { BoardModule } from '../../../../modules/board/board.module';
import { EffectsModule } from '../../../../modules/effects/effects.module';
import { GameRegistryModule } from '../../../../engine/game-registry.module';
import { PlayerModule } from '../../../../modules/player/player.module';
import { ActionResolverModule } from '../../../../modules/action-resolver/action-resolver.module';
import { ActionLogModule } from '../../../../modules/actionlog/actionlog.module';
import { QuizModule } from '../../../../modules/quiz/quiz.module';
import { ExchangeModule } from '../../../../modules/exchange/exchange.module';
import { VictoryModule } from '../../../../modules/victory/victory.module';
import { BotModule } from '../../../../modules/bot/bot.module';
import { PanierExpressService } from './services/panier-express.service';
import { PanierExpressSetupService } from './services/panier-express-setup.service';
import { PanierExpressDrawService } from './services/panier-express-draw.service';
import { PanierExpressQuizService } from './services/panier-express-quiz.service';
import { PanierExpressExchangeService } from './services/panier-express-exchange.service';

@Module({
  imports: [
    GameCoreModule,
    CardsModule,
    TurnModule,
    BoardModule,
    EffectsModule,
    GameRegistryModule,
    PlayerModule,
    ActionResolverModule,
    ActionLogModule,
    QuizModule,
    ExchangeModule,
    VictoryModule,
    BotModule,
  ],
  providers: [PanierExpressService, PanierExpressSetupService, PanierExpressDrawService, PanierExpressQuizService, PanierExpressExchangeService],
  exports: [PanierExpressService, PanierExpressSetupService, PanierExpressDrawService, PanierExpressQuizService, PanierExpressExchangeService],
})
export class PanierExpressModule {}

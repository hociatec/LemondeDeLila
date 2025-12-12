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
  providers: [PanierExpressService],
  exports: [PanierExpressService],
})
export class PanierExpressModule {}

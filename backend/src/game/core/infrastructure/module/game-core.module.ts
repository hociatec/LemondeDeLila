import { Global, Module, forwardRef } from '@nestjs/common';
import { BotModule } from './bot.module';
import { GameCoreService } from '../../application/services/game-core.service';
import { BoardModule } from './board.module';
import { CardsModule } from '../../../cards/public-api';
import { EffectsModule } from '../../../effects/infrastructure/effects.module';
import { ExchangeModule } from '../../../exchange/infrastructure/exchange.module';
import { InventoryModule } from './inventory.module';
import { MovementModule } from '../../../movement/infrastructure/movement.module';
import { QuizModule } from '../../../quiz/infrastructure/quiz.module';
import { TurnModule } from './turn.module';
import { VictoryModule } from '../../../victory/infrastructure/victory.module';

@Global()
@Module({
  imports: [
    BoardModule,
    MovementModule,
    CardsModule,
    InventoryModule,
    ExchangeModule,
    QuizModule,
    EffectsModule,
    BotModule,
    forwardRef(() => TurnModule),
    VictoryModule,
  ],
  providers: [GameCoreService],
  exports: [GameCoreService],
})
export class GameCoreModule {}



import { Global, Module, forwardRef } from '@nestjs/common';
import { BotModule } from '../infrastructure/module/bot.module';
import { GameCoreService } from '../application/services/game-core.service';
import { BoardModule } from '../application/modules/board.module';
import { CardsModule } from '../application/modules/cards.module';
import { EffectsModule } from '../application/modules/effects.module';
import { ExchangeModule } from '../application/modules/exchange.module';
import { InventoryModule } from '../application/modules/inventory.module';
import { MovementModule } from '../application/modules/movement.module';
import { QuizModule } from '../application/modules/quiz.module';
import { TurnModule } from '../application/modules/turn.module';
import { VictoryModule } from '../application/modules/victory.module';

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



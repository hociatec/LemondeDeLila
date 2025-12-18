import { Module } from '@nestjs/common';
import { GameCoreService } from './services/game-core.service';
import { BoardModule } from '../modules/board/board.module';
import { MovementModule } from '../modules/movement/movement.module';
import { CardsModule } from '../modules/cards/cards.module';
import { InventoryModule } from '../modules/inventory/inventory.module';
import { ExchangeModule } from '../modules/exchange/exchange.module';
import { QuizModule } from '../modules/quiz/quiz.module';
import { EffectsModule } from '../modules/effects/effects.module';
import { BotModule } from '../modules/bot/bot.module';
import { TurnModule } from '../modules/turn/turn.module';
import { VictoryModule } from '../modules/victory/victory.module';

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
    TurnModule,
    VictoryModule,
  ],
  providers: [GameCoreService],
  exports: [GameCoreService],
})
export class GameCoreModule {}

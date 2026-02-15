import { Module } from '@nestjs/common';
import { GameRegistryModule } from '../engine/game-registry.module';
import { BoardModule } from '../modules/board/board.module';
import { CardsModule } from '../modules/cards/cards.module';
import { MovementModule } from '../modules/movement/movement.module';
import { InventoryModule } from '../modules/inventory/inventory.module';
import { ExchangeModule } from '../modules/exchange/exchange.module';
import { TurnModule } from '../modules/turn/turn.module';
import { EffectsModule } from '../modules/effects/effects.module';
import { QuizModule } from '../modules/quiz/quiz.module';
import { VictoryModule } from '../modules/victory/victory.module';
import { GameContentService } from '../engine/services/game-content.service';
import { GameModuleOverviewRegistryService } from '../modules/game-module-overview.service';
import { GameWsHandler } from './service/game-ws.handler';
import { GameWsRegistrar } from './service/game-ws.registrar';

@Module({
  imports: [
    GameRegistryModule,
    BoardModule,
    CardsModule,
    MovementModule,
    InventoryModule,
    ExchangeModule,
    TurnModule,
    EffectsModule,
    QuizModule,
    VictoryModule,
  ],
  providers: [
    GameContentService,
    GameModuleOverviewRegistryService,
    GameWsHandler,
    GameWsRegistrar,
  ],
})
export class GameWsModule {}

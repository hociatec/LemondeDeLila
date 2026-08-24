import { GameRegistryModule } from '../../../module/game-registry.module';
import { BoardModule } from '../../../application/modules/board.module';
import { CardsModule } from '../../../application/modules/cards.module';
import { MovementModule } from '../../../application/modules/movement.module';
import { InventoryModule } from '../../../application/modules/inventory.module';
import { ExchangeModule } from '../../../application/modules/exchange.module';
import { TurnModule } from '../../../application/modules/turn.module';
import { EffectsModule } from '../../../application/modules/effects.module';
import { QuizModule } from '../../../application/modules/quiz.module';
import { VictoryModule } from '../../../application/modules/victory.module';

export const GAME_WS_MODULE_IMPORTS = [
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
];




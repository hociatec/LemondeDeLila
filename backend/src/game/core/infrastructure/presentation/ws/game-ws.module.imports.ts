import { TypeOrmModule } from '@nestjs/typeorm';
import { GameRegistryModule } from '../../../../engine/infrastructure/module/game-registry.module';
import { EngineServicesModule } from '../../module/engine-services.module';
import { BoardModule } from '../../module/board.module';
import { CardsModule } from '../../../../cards/public-api';
import { MovementModule } from '../../../../movement/infrastructure/movement.module';
import { InventoryModule } from '../../module/inventory.module';
import { ExchangeModule } from '../../../../exchange/infrastructure/exchange.module';
import { TurnModule } from '../../module/turn.module';
import { EffectsModule } from '../../../../effects/infrastructure/effects.module';
import { QuizModule } from '../../../../quiz/infrastructure/quiz.module';
import { VictoryModule } from '../../../../victory/infrastructure/victory.module';
import { Room } from '../../../../../room/infrastructure/persistence/typeorm/entities/room.entity';
import { RoomBot } from '../../../../../room/infrastructure/persistence/typeorm/entities/room-bot.entity';
import { RoomParticipant } from '../../../../../room/infrastructure/persistence/typeorm/entities/room-participant.entity';
import { BotModule } from '../../module/bot.module';
import { RoomModule } from '../../../../../room/public-api';

export const GAME_WS_MODULE_IMPORTS = [
  GameRegistryModule,
  EngineServicesModule,
  BotModule,
  RoomModule,
  TypeOrmModule.forFeature([Room, RoomParticipant, RoomBot]),
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

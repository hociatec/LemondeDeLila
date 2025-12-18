import { Module } from '@nestjs/common';
import { RoomModule } from '../../room/room.module';
import { GameCoreModule } from '../core/core.module';
import { BotModule } from '../modules/bot/bot.module';
import { TurnModule } from '../modules/turn/turn.module';
import { GameRegistryModule } from './game-registry.module';
import { GameEngineService } from './services/game-engine.service';
import { GameEngineStateStore } from './services/game-engine-state.store';
import { GameGateway } from './gateways/game.gateway';

@Module({
  imports: [RoomModule, GameCoreModule, GameRegistryModule, BotModule, TurnModule],
  providers: [GameEngineService, GameEngineStateStore, GameGateway],
  exports: [GameEngineService],
})
export class EngineModule {}

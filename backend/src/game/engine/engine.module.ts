import { Module } from '@nestjs/common';
import { RoomModule } from '../../room/room.module';
import { GameCoreModule } from '../core/core.module';
import { GameRegistryModule } from './game-registry.module';
import { GameEngineService } from './services/game-engine.service';
import { GameGateway } from './gateways/game.gateway';

@Module({
  imports: [RoomModule, GameCoreModule, GameRegistryModule],
  providers: [GameEngineService, GameGateway],
  exports: [GameEngineService],
})
export class EngineModule {}

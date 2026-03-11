import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoomModule } from '../../room/room.module';
import { GameCoreModule } from '../core/core.module';
import { BotModule } from '../modules/bot/bot.module';
import { BoardModule } from '../modules/board/board.module';
import { GridModule } from '../modules/grid/grid.module';
import { TurnModule } from '../modules/turn/turn.module';
import { GameRegistryModule } from './game-registry.module';
import { GameEngineService } from './services/game-engine.service';
import { GameEngineStateStore } from './services/game-engine-state.store';
import { GameContentService } from './services/game-content.service';
import { GameGateway } from './gateways/game.gateway';
import { EngineServicesModule } from './services/engine-services.module';
import { StatsModule } from '../../stats/stats.module';
import { ClientUpdatesModule } from '../../client-updates/client-updates.module';
import { SocialProfile } from '../../social/entities/social-profile.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([SocialProfile]),
    RoomModule,
    GameCoreModule,
    GameRegistryModule,
    BotModule,
    BoardModule,
    GridModule,
    TurnModule,
    EngineServicesModule,
    StatsModule,
    ClientUpdatesModule,
  ],
  providers: [
    GameEngineService,
    GameEngineStateStore,
    GameContentService,
    GameGateway,
  ],
  exports: [GameEngineService, EngineServicesModule],
})
export class EngineModule {}

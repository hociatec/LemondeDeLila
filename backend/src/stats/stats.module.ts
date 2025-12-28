import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogModule } from '../catalog/catalog.module';
import { User } from '../user/entities/user.entity';
import { GameMatch } from './entities/game-match.entity';
import { GameMatchPlayer } from './entities/game-match-player.entity';
import { GameStatsService } from './services/game-stats.service';
import { StatsWsHandler } from './ws/stats-ws.handler';
import { StatsWsRegistrar } from './ws/stats-ws.registrar';

@Module({
  imports: [TypeOrmModule.forFeature([GameMatch, GameMatchPlayer, User]), CatalogModule],
  providers: [GameStatsService, StatsWsHandler, StatsWsRegistrar],
  exports: [GameStatsService],
})
export class StatsModule {}


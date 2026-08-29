import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogModule } from '../../catalog/public-api';
import { SocialModule } from '../../social/public-api';
import { GameMatchEntity } from '../infrastructure/persistence/typeorm/entities/game-match.entity';
import { GameMatchPlayerEntity } from '../infrastructure/persistence/typeorm/entities/game-match-player.entity';

export const STATS_MODULE_IMPORTS = [
  TypeOrmModule.forFeature([GameMatchEntity, GameMatchPlayerEntity]),
  CatalogModule,
  SocialModule,
];

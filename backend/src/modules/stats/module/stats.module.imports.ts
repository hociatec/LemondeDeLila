import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessClockModule } from '../../../platform/time/public-api';
import { CatalogModule } from '../../catalog/composition-api';
import { SocialModule } from '../../social/composition-api';
import { GameMatchEntity } from '../infrastructure/persistence/typeorm/entities/game-match.entity';
import { GameMatchPlayerEntity } from '../infrastructure/persistence/typeorm/entities/game-match-player.entity';

export const STATS_MODULE_IMPORTS = [
  BusinessClockModule,
  TypeOrmModule.forFeature([GameMatchEntity, GameMatchPlayerEntity]),
  CatalogModule,
  SocialModule,
];

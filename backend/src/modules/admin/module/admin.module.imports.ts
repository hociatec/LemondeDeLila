import { BusinessClockModule } from '../../../platform/time/public-api';
import { RedisModule } from '../../../platform/redis/public-api';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BotModule as RoomBotModule } from '../../bot/composition-api';
import { BugReportsModule } from '../../bug-reports/composition-api';
import { CatalogModule } from '../../catalog/composition-api';
import { ChatModule } from '../../chat/composition-api';
import { ValidationModule } from '../../../platform/validation/public-api';
import { EngineServicesModule } from '../../../game/composition-api';
import { GameRegistryModule } from '../../../game/composition-api';
import { BotModule as GameBotModule } from '../../../game/composition-api';
import { NotificationModule } from '../../notification/composition-api';
import { RoomModule } from '../../room/composition-api';
import { SocialModule } from '../../social/composition-api';
import { StatsModule } from '../../stats/composition-api';
import { UpdateModule } from '../../update/composition-api';
import { UserModule } from '../../user/composition-api';
import { RoleDefinitionEntity } from '../infrastructure/persistence/typeorm/entities/role-definition.entity';

export const ADMIN_MODULE_IMPORTS = [
  BusinessClockModule,
  RedisModule,
  TypeOrmModule.forFeature([RoleDefinitionEntity]),
  UserModule,
  ValidationModule,
  EngineServicesModule,
  GameRegistryModule,
  NotificationModule,
  UpdateModule,
  ChatModule,
  CatalogModule,
  RoomBotModule,
  GameBotModule,
  RoomModule,
  SocialModule,
  BugReportsModule,
  StatsModule,
];

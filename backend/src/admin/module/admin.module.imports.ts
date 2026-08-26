import { TypeOrmModule } from '@nestjs/typeorm';

import { BotModule as RoomBotModule } from '../../bot/public-api';
import { BugReportsModule } from '../../bug-reports/public-api';
import { CatalogModule } from '../../catalog/public-api';
import { ChatModule } from '../../chat/public-api';
import { ValidationModule } from '../../common/validation/public-api';
import { EngineServicesModule } from '../../game/core/infrastructure/module/engine-services.module';
import { GameRegistryModule } from '../../game/public-api';
import { BotModule as GameBotModule } from '../../game/public-api';
import { NotificationModule } from '../../notification/public-api';
import { RoomModule } from '../../room/public-api';
import { SocialModule } from '../../social/public-api';
import { StatsModule } from '../../stats/public-api';
import { UpdateModule } from '../../update/public-api';
import { User } from '../../user/public-api';
import { RoleDefinitionEntity } from '../infrastructure/persistence/typeorm/entities/role-definition.entity';

export const ADMIN_MODULE_IMPORTS = [
  TypeOrmModule.forFeature([User, RoleDefinitionEntity]),
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

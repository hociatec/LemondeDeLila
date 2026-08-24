import { TypeOrmModule } from '@nestjs/typeorm';

import { BotModule as RoomBotModule } from '../../bot/public-api';
import { BugReportsModule } from '../../bug-reports/public-api';
import { CatalogModule } from '../../catalog/public-api';
import { ChatModule } from '../../chat/public-api';
import { ClientUpdatesModule } from '../../client-updates/public-api';
import { ValidationModule } from '../../common/validation/public-api';
import { EngineServicesModule } from '../../game/infrastructure/module/engine-services.module';
import { GameRegistryModule } from '../../game/public-api';
import { ArcheDeMnemosyneModule } from '../../game/games/vents-infinis/arche-de-mnemosyne/public-api';
import { BotModule as GameBotModule } from '../../game/public-api';
import { NotificationModule } from '../../notification/public-api';
import { RoomModule } from '../../room/public-api';
import { SocialModule } from '../../social/public-api';
import { StatsModule } from '../../stats/public-api';
import { User } from '../../user/public-api';
import { RoleDefinitionEntity } from '../infrastructure/persistence/typeorm/entities/role-definition.entity';

export const ADMIN_MODULE_IMPORTS = [
  TypeOrmModule.forFeature([User, RoleDefinitionEntity]),
  ValidationModule,
  EngineServicesModule,
  GameRegistryModule,
  ArcheDeMnemosyneModule,
  NotificationModule,
  ClientUpdatesModule,
  ChatModule,
  CatalogModule,
  RoomBotModule,
  GameBotModule,
  RoomModule,
  SocialModule,
  BugReportsModule,
  StatsModule,
];
